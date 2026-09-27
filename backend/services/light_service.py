from database.repositories.sensor_repository import (
    get_latest_sensor_observation,
)

from database.repositories.vision_repository import (
    get_latest_vision_observation,
)

from database.repositories.room_repository import (
    get_room_by_id,
)


LIGHT_WASTAGE_THRESHOLD = 4


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def get_latest_light_observation(room_id):
    return get_latest_sensor_observation(
        room_id=room_id,
        observation_type="LIGHT"
    )


def get_latest_occupancy_observation(room_id):
    return get_latest_vision_observation(
        room_id=room_id,
        observation_type="OCCUPANCY"
    )


def extract_light_state(observation):
    if observation is None:
        return None

    observation_data = observation[5]

    return observation_data.get("light_state")


def extract_occupancy_count(observation):
    if observation is None:
        return None

    observation_data = observation[5]

    return observation_data.get("occupancy_count")


def evaluate_light_status(room_id):
    validate_room_exists(room_id)

    light_observation = get_latest_light_observation(
        room_id
    )

    occupancy_observation = get_latest_occupancy_observation(
        room_id
    )

    light_state = extract_light_state(
        light_observation
    )

    occupancy_count = extract_occupancy_count(
        occupancy_observation
    )

    if light_state is None or occupancy_count is None:
        return {
            "status": "UNKNOWN",
            "light_state": light_state,
            "occupancy_count": occupancy_count,
        }

    if light_state == "OFF":
        return {
            "status": "NORMAL",
            "light_state": light_state,
            "occupancy_count": occupancy_count,
        }

    if light_state == "ON" and occupancy_count > 0:
        return {
            "status": "NORMAL",
            "light_state": light_state,
            "occupancy_count": occupancy_count,
        }

    if light_state == "ON" and occupancy_count == 0:
        return {
            "status": "WASTAGE_CANDIDATE",
            "light_state": light_state,
            "occupancy_count": occupancy_count,
        }

    return {
        "status": "UNKNOWN",
        "light_state": light_state,
        "occupancy_count": occupancy_count,
    }


def is_light_wastage_candidate(room_id):
    result = evaluate_light_status(room_id)

    return result["status"] == "WASTAGE_CANDIDATE"


def confirm_light_wastage(abnormal_count):
    return abnormal_count >= LIGHT_WASTAGE_THRESHOLD