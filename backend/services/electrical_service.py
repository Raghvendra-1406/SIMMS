from config.settings import (
    MAIN_CURRENT_MAX_A,
    POWER_FACTOR_MIN,
    POWER_FACTOR_MIN_CURRENT_A,
    VOLTAGE_MAX_V,
    VOLTAGE_MIN_V,
)

from database.repositories.room_repository import (
    get_room_by_id,
)

from services.circuit_service import (
    FANS,
    LIGHTS,
    MAIN,
    evaluate_circuit,
    get_circuit_reading,
    get_latest_electrical,
)


ELECTRICAL_ABNORMALITY_THRESHOLD = 4


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def _low_power_factor(reading):
    if not reading:
        return False

    power_factor = reading.get("power_factor")
    current = reading.get("current") or 0

    return (
        power_factor is not None
        and current >= POWER_FACTOR_MIN_CURRENT_A
        and power_factor < POWER_FACTOR_MIN
    )


def evaluate_electrical_status(room_id, electrical_data=None):
    """
    Electrical abnormality on the room's supply:

    - supply voltage outside VOLTAGE_MIN_V .. VOLTAGE_MAX_V
    - main supply current above MAIN_CURRENT_MAX_A
    - a LIGHTS / FANS circuit drawing more than all its units could
      (short circuit, stalled motors, wrong load on the circuit)
    - low power factor on a loaded circuit
    """

    validate_room_exists(room_id)

    if electrical_data is None:
        electrical_data = get_latest_electrical(room_id)

    if electrical_data is None:
        return {
            "status": "UNKNOWN",
            "abnormal_fields": [],
            "data": None,
        }

    abnormal = []

    voltage = electrical_data.get("voltage")

    if voltage is not None and not (
        VOLTAGE_MIN_V <= float(voltage) <= VOLTAGE_MAX_V
    ):
        abnormal.append(f"supply voltage {float(voltage):.0f} V")

    main = get_circuit_reading(electrical_data, MAIN)

    if main and (main.get("current") or 0) > MAIN_CURRENT_MAX_A:
        abnormal.append(f"main supply overcurrent {main['current']:.1f} A")

    if _low_power_factor(main):
        abnormal.append(f"main supply power factor {main['power_factor']}")

    for circuit in (LIGHTS, FANS):
        summary = evaluate_circuit(room_id, circuit, electrical_data)

        if summary["overloaded"]:
            abnormal.append(
                f"{circuit.lower()} circuit overcurrent "
                f"{summary['current']:.1f} A "
                f"(max {summary['expected_max_current_a']:.1f} A)"
            )

        if _low_power_factor(get_circuit_reading(electrical_data, circuit)):
            abnormal.append(
                f"{circuit.lower()} circuit power factor "
                f"{summary['power_factor']}"
            )

    return {
        "status": "ABNORMALITY_CANDIDATE" if abnormal else "NORMAL",
        "abnormal_fields": abnormal,
        "data": electrical_data,
    }
