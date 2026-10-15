from datetime import datetime, timezone

from config.settings import (
    CIRCUIT_OVERLOAD_FACTOR,
    CIRCUIT_OVERLOAD_MARGIN_A,
    DEFAULT_FAN_CURRENT_A,
    DEFAULT_LIGHT_CURRENT_A,
)

from database.repositories.sensor_repository import (
    get_latest_sensor_observation,
)

from database.repositories.device_repository import (
    get_devices_by_room,
)

from database.repositories.circuit_baseline_repository import (
    get_room_baselines,
)


# Circuits a classroom is metered on. MAIN (whole-room supply) is
# optional; LIGHTS and FANS each carry every unit of one kind.
MAIN = "MAIN"
LIGHTS = "LIGHTS"
FANS = "FANS"

UNIT_CIRCUITS = {
    LIGHTS: {"device_type": "LIGHT", "default_unit_a": DEFAULT_LIGHT_CURRENT_A},
    FANS: {"device_type": "FAN", "default_unit_a": DEFAULT_FAN_CURRENT_A},
}

# Electrical readings older than this are treated as missing.
MAX_READING_AGE_MINUTES = 5


def get_latest_electrical(room_id):
    """
    Latest ELECTRICAL observation data for the room, or None when
    missing or stale.

    Payload (firmware):
        {"voltage": 230.1,
         "circuits": {"MAIN":   {"current", "power", "power_factor", "energy"},
                      "LIGHTS": {...},
                      "FANS":   {...}}}
    A flat payload without "circuits" is read as the MAIN circuit.
    """

    observation = get_latest_sensor_observation(
        room_id=room_id,
        observation_type="ELECTRICAL"
    )

    if observation is None:
        return None

    age_minutes = (
        datetime.now(timezone.utc) - observation[3]
    ).total_seconds() / 60

    if age_minutes > MAX_READING_AGE_MINUTES:
        return None

    return observation[5]


def get_circuit_reading(electrical_data, circuit):
    if not electrical_data:
        return None

    circuits = electrical_data.get("circuits")

    if isinstance(circuits, dict):
        reading = circuits.get(circuit)
        return reading if isinstance(reading, dict) else None

    # Legacy flat payload: one meter on the whole room.
    if circuit == MAIN:
        return electrical_data

    return None


def get_active_units(room_id, circuit):
    """
    ACTIVE devices on a circuit, e.g. every FAN in the room for FANS.
    """

    device_type = UNIT_CIRCUITS[circuit]["device_type"]

    return [
        device
        for device in get_devices_by_room(room_id)
        if str(device[2]).upper() == device_type
        and device[4] == "ACTIVE"
    ]


def get_baseline(room_id, circuit, baselines=None):
    """
    (unit_current_a, standby_current_a, learned) for the circuit.
    Falls back to the configured default until a baseline is learned.
    """

    if baselines is None:
        baselines = get_room_baselines(room_id)

    learned = baselines.get(circuit)

    if learned is not None:
        return learned[0], learned[1], True

    return UNIT_CIRCUITS[circuit]["default_unit_a"], 0.0, False


def summarise_circuit(reading, units_total, baseline):
    """
    Derive how many units are powered from the circuit current.

    powered_units = round((current - standby) / unit current)

    A circuit is overloaded when its current exceeds what all its
    units could draw (with margin).
    """

    unit_current, standby_current, learned = baseline

    summary = {
        "units_total": units_total,
        "unit_current_a": round(unit_current, 3),
        "standby_current_a": round(standby_current, 3),
        "baseline_learned": learned,
        "current": None,
        "power": None,
        "power_factor": None,
        "energy": None,
        "powered_units": None,
        "expected_max_current_a": round(
            units_total * unit_current * CIRCUIT_OVERLOAD_FACTOR
            + standby_current
            + CIRCUIT_OVERLOAD_MARGIN_A,
            3
        ),
        "overloaded": False,
    }

    if reading is None or reading.get("current") is None:
        return summary

    current = float(reading["current"])

    summary.update({
        "current": current,
        "power": reading.get("power"),
        "power_factor": reading.get("power_factor"),
        "energy": reading.get("energy"),
        "powered_units": max(
            0,
            round((current - standby_current) / unit_current)
        ) if unit_current > 0 else None,
        "overloaded": current > summary["expected_max_current_a"],
    })

    return summary


def evaluate_circuit(room_id, circuit, electrical_data=None):
    """
    Summary of a LIGHTS / FANS circuit for the room from the
    latest electrical reading.
    """

    if electrical_data is None:
        electrical_data = get_latest_electrical(room_id)

    return summarise_circuit(
        reading=get_circuit_reading(electrical_data, circuit),
        units_total=len(get_active_units(room_id, circuit)),
        baseline=get_baseline(room_id, circuit)
    )


def learn_baseline(room_id, circuit, units_on):
    """
    Commissioning: learn the circuit's per-unit current from the
    latest reading, with a known number of units switched on.

    units_on = 0 records the standby current (nothing switched on);
    units_on > 0 records unit current = (current - standby) / units_on.
    """

    # Imported here to keep this module free of write paths at import.
    from database.repositories.circuit_baseline_repository import (
        upsert_baseline,
    )

    if circuit not in UNIT_CIRCUITS:
        raise ValueError("Circuit must be LIGHTS or FANS.")

    if units_on < 0:
        raise ValueError("units_on cannot be negative.")

    reading = get_circuit_reading(get_latest_electrical(room_id), circuit)

    if reading is None or reading.get("current") is None:
        raise ValueError(
            f"No recent {circuit} reading for this room. Make sure the "
            f"node is online, then try again."
        )

    current = float(reading["current"])

    unit_current, standby_current, _ = get_baseline(room_id, circuit)

    if units_on == 0:
        standby_current = current

    else:
        unit_current = (current - standby_current) / units_on

        if unit_current <= 0.01:
            raise ValueError(
                f"The {circuit} circuit draws only {current:.2f} A with "
                f"{units_on} units on. Check that they are switched on."
            )

    row = upsert_baseline(
        room_id=room_id,
        circuit=circuit,
        unit_current_a=round(unit_current, 3),
        standby_current_a=round(standby_current, 3),
        learned_units=units_on if units_on > 0 else None
    )

    return {
        "circuit": row[0],
        "unit_current_a": float(row[1]),
        "standby_current_a": float(row[2]),
        "learned_units": row[3],
        "learned_at": row[4],
        "measured_current_a": current,
    }


def set_baseline(room_id, circuit, unit_current_a, standby_current_a):
    from database.repositories.circuit_baseline_repository import (
        upsert_baseline,
    )

    if circuit not in UNIT_CIRCUITS:
        raise ValueError("Circuit must be LIGHTS or FANS.")

    if unit_current_a <= 0 or standby_current_a < 0:
        raise ValueError(
            "Unit current must be positive and standby current "
            "cannot be negative."
        )

    row = upsert_baseline(
        room_id=room_id,
        circuit=circuit,
        unit_current_a=unit_current_a,
        standby_current_a=standby_current_a
    )

    return {
        "circuit": row[0],
        "unit_current_a": float(row[1]),
        "standby_current_a": float(row[2]),
        "learned_units": row[3],
        "learned_at": row[4],
    }
