from database.repositories.sensor_repository import (
    get_latest_sensor_observation,
)

from database.repositories.vision_repository import (
    get_latest_vision_observation,
)

from database.repositories.room_repository import (
    get_room_by_id,
)

from config.settings import (
    VACANCY_MINUTES,
)

from services.occupancy_service import (
    get_vacancy,
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
    """
    Lights left on = light ON while the room has been vacant for
    at least VACANCY_MINUTES (Plan v2 §8.6). A room that just
    emptied, or one in use, is normal.
    """

    validate_room_exists(room_id)

    light_state = extract_light_state(
        get_latest_light_observation(room_id)
    )

    if light_state is None:
        return {
            "status": "UNKNOWN",
            "light_state": None,
            "occupied": None,
            "vacant_minutes": None,
        }

    if light_state == "OFF":
        return {
            "status": "NORMAL",
            "light_state": light_state,
            "occupied": None,
            "vacant_minutes": None,
        }

    vacancy = get_vacancy(room_id)

    result = {
        "light_state": light_state,
        "occupied": vacancy["occupied"],
        "vacant_minutes": vacancy["vacant_minutes"],
    }

    if vacancy["occupied"] is None:
        return {
            "status": "UNKNOWN",
            **result,
        }

    if vacancy["occupied"]:
        return {
            "status": "NORMAL",
            **result,
        }

    if (
        vacancy["vacant_minutes"] is not None
        and vacancy["vacant_minutes"] >= VACANCY_MINUTES
    ):
        return {
            "status": "WASTAGE_CANDIDATE",
            **result,
        }

    return {
        "status": "NORMAL",
        **result,
    }


def is_light_wastage_candidate(room_id):
    result = evaluate_light_status(room_id)

    return result["status"] == "WASTAGE_CANDIDATE"


def confirm_light_wastage(abnormal_count):
    return abnormal_count >= LIGHT_WASTAGE_THRESHOLD