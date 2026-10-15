from config.settings import (
    MIN_VOTE_CONFIDENCE,
)

from database.repositories.vision_repository import (
    get_latest_device_observations,
)

from services.circuit_service import (
    FANS,
    LIGHTS,
    evaluate_circuit,
    get_active_units,
    get_latest_electrical,
)

from services.fault_types import (
    FAULT_FAN_FAILURE,
    FAULT_LIGHT_FAILURE,
)


# Per-unit checks: the circuit current says HOW MANY units are
# powered; the camera says WHICH units work (fan rotating, tube lit).
# A unit that is powered but not working is faulty (Plan v2 §8.5).
UNIT_KINDS = {
    "FAN": {
        "circuit": FANS,
        "observation_type": "FAN_MOTION",
        "data_key": "fan_motion",
        "working_field": "running",
        "fault_type": FAULT_FAN_FAILURE,
        "noun": "fan",
        "working_word": "rotating",
        "failed_word": "powered but not rotating",
    },
    "LIGHT": {
        "circuit": LIGHTS,
        "observation_type": "LIGHT",
        "data_key": "light",
        "working_field": "lit",
        "fault_type": FAULT_LIGHT_FAILURE,
        "noun": "tube light",
        "working_word": "lit",
        "failed_word": "powered but dark",
    },
}

# Camera observations older than this are treated as missing.
MAX_VISION_AGE_MINUTES = 5


def unit_state(observation_data, kind):
    """
    True = working, False = not working, None = unknown
    (no usable camera reading).
    """

    config = UNIT_KINDS[kind]

    if not isinstance(observation_data, dict):
        return None

    state = observation_data.get(config["data_key"])

    if not isinstance(state, dict):
        return None

    working = state.get(config["working_field"])

    if working is None:
        return None

    if (state.get("confidence") or 0) < MIN_VOTE_CONFIDENCE:
        return None

    return bool(working)


def classify_units(powered_units, unit_states):
    """
    Compare the powered count with the camera's view of each unit.

    unit_states: {device_id: True / False / None}

    Returns a dict with:
      status      UNKNOWN (no circuit reading), NO_VISION (no camera
                  data at all), NORMAL or FAULT
      working, not_working, unknown   device id lists
      faulty_count  powered units that are not working
      suspects      not-working units that may be the faulty ones
      pinpointed    True when every suspect is certainly faulty

    Conservative by design: units the camera cannot see explain an
    excess before any working-looking unit is blamed, so an
    unmonitored fan never causes a false ticket.
    """

    working = [d for d, s in unit_states.items() if s is True]
    not_working = [d for d, s in unit_states.items() if s is False]
    unknown = [d for d, s in unit_states.items() if s is None]

    result = {
        "status": "NORMAL",
        "powered_units": powered_units,
        "working": working,
        "not_working": not_working,
        "unknown": unknown,
        "faulty_count": 0,
        "suspects": [],
        "pinpointed": False,
    }

    if powered_units is None:
        result["status"] = "UNKNOWN"
        return result

    if unit_states and not working and not not_working:
        result["status"] = "NO_VISION"
        return result

    # Powered units the camera does not see working, after giving the
    # benefit of the doubt to units it cannot see at all.
    unexplained = powered_units - len(working) - len(unknown)

    if unexplained <= 0 or not not_working:
        return result

    faulty_count = min(unexplained, len(not_working))

    result.update({
        "status": "FAULT",
        "faulty_count": faulty_count,
        "suspects": not_working,
        "pinpointed": faulty_count == len(not_working),
    })

    return result


def describe(kind, result, names):
    """
    One-line explanation for tickets and the dashboard.
    """

    config = UNIT_KINDS[kind]
    noun = config["noun"]

    powered = result["powered_units"]
    working = len(result["working"])

    if powered is None:
        return (
            f"{noun.capitalize()} count unavailable "
            f"(no circuit reading, or the circuit is overloaded)"
        )

    if result["status"] == "NO_VISION":
        return (
            f"{powered} {noun}{'s' if powered != 1 else ''} powered "
            f"(camera not reporting)"
        )
    suspects = [names.get(d, f"#{d}") for d in result["suspects"]]

    text = (
        f"{powered} {noun}{'s' if powered != 1 else ''} powered, "
        f"{working} {config['working_word']}"
    )

    if result["status"] != "FAULT":
        return text

    if result["pinpointed"]:
        return f"{text}: {', '.join(suspects)} {config['failed_word']}"

    return (
        f"{text}: {result['faulty_count']} of "
        f"{', '.join(suspects)} {config['failed_word']}"
    )


def evaluate_units(room_id, kind, electrical_data=None):
    """
    Circuit summary + per-unit classification for one kind of unit
    (FAN or LIGHT) in a room.
    """

    config = UNIT_KINDS[kind]

    if electrical_data is None:
        electrical_data = get_latest_electrical(room_id)

    circuit = evaluate_circuit(
        room_id,
        config["circuit"],
        electrical_data=electrical_data
    )

    units = get_active_units(room_id, config["circuit"])

    names = {device[0]: device[3] for device in units}

    observations = get_latest_device_observations(
        room_id=room_id,
        observation_type=config["observation_type"],
        max_age_minutes=MAX_VISION_AGE_MINUTES
    )

    unit_states = {
        device_id: unit_state(observations.get(device_id), kind)
        for device_id in names
    }

    # An overloaded circuit's current no longer reflects how many
    # units are on (short circuit, stalled motors); the electrical
    # abnormality rule reports it, the unit check stands down.
    result = classify_units(
        None if circuit["overloaded"] else circuit["powered_units"],
        unit_states
    )

    result.update({
        "kind": kind,
        "circuit": circuit,
        "names": names,
        "unit_states": unit_states,
        "summary": describe(kind, result, names),
    })

    return result


def unit_condition(room_id, kind, device_id):
    """
    For verification: is this unit (or, with device_id None, the
    circuit as a whole) still faulty?

    Returns True (fault persists), False (repaired) or None
    (cannot tell, e.g. the unit is switched off or not visible).
    """

    result = evaluate_units(room_id, kind)

    if result["status"] in {"UNKNOWN", "NO_VISION"}:
        return None

    if device_id is None:
        return result["status"] == "FAULT"

    state = result["unit_states"].get(device_id)

    if state is True:
        return False

    if device_id in result["suspects"]:
        return True

    return None
