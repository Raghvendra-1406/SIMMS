from database.repositories.sensor_repository import (
    get_latest_sensor_observation,
)

from database.repositories.room_repository import (
    get_room_by_id,
)


ELECTRICAL_ABNORMALITY_THRESHOLD = 4

VOLTAGE_MIN = 200.0
VOLTAGE_MAX = 250.0

CURRENT_MIN = 0.0
CURRENT_MAX = 20.0

POWER_MIN = 0.0
POWER_MAX = 5000.0

POWER_FACTOR_MIN = 0.5
POWER_FACTOR_MAX = 1.0


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def get_latest_electrical_observation(room_id):
    return get_latest_sensor_observation(
        room_id=room_id,
        observation_type="ELECTRICAL"
    )


def extract_electrical_data(observation):
    if observation is None:
        return None

    observation_data = observation[5]

    return observation_data


def check_voltage(voltage):
    if voltage is None:
        return True

    return VOLTAGE_MIN <= voltage <= VOLTAGE_MAX


def check_current(current):
    if current is None:
        return True

    return CURRENT_MIN <= current <= CURRENT_MAX


def check_power(power):
    if power is None:
        return True

    return POWER_MIN <= power <= POWER_MAX


def check_power_factor(power_factor):
    if power_factor is None:
        return True

    return POWER_FACTOR_MIN <= power_factor <= POWER_FACTOR_MAX


def evaluate_electrical_status(room_id):
    validate_room_exists(room_id)

    observation = get_latest_electrical_observation(
        room_id
    )

    electrical_data = extract_electrical_data(
        observation
    )

    if electrical_data is None:
        return {
            "status": "UNKNOWN",
            "abnormal_fields": [],
            "data": None,
        }

    voltage = electrical_data.get("voltage")
    current = electrical_data.get("current")
    power = electrical_data.get("power")
    power_factor = electrical_data.get("power_factor")

    abnormal_fields = []

    if not check_voltage(voltage):
        abnormal_fields.append("voltage")

    if not check_current(current):
        abnormal_fields.append("current")

    if not check_power(power):
        abnormal_fields.append("power")

    if not check_power_factor(power_factor):
        abnormal_fields.append("power_factor")

    if abnormal_fields:
        return {
            "status": "ABNORMALITY_CANDIDATE",
            "abnormal_fields": abnormal_fields,
            "data": electrical_data,
        }

    return {
        "status": "NORMAL",
        "abnormal_fields": [],
        "data": electrical_data,
    }


def is_electrical_abnormality_candidate(room_id):
    result = evaluate_electrical_status(
        room_id
    )

    return result["status"] == "ABNORMALITY_CANDIDATE"


def confirm_electrical_abnormality(abnormal_count):
    return abnormal_count >= ELECTRICAL_ABNORMALITY_THRESHOLD