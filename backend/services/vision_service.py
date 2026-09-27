from datetime import datetime, timezone

from database.repositories.vision_repository import (
    create_vision_observation,
    get_latest_vision_observation,
    get_recent_vision_observations,
    get_vision_observation_by_id,
    get_vision_observations_by_device,
    get_vision_observations_by_room,
)

from database.repositories.device_repository import get_device_by_id
from database.repositories.room_repository import get_room_by_id


ALLOWED_OBSERVATION_TYPES = {
    "OCCUPANCY",
    "FAN_MOTION",
}


def validate_observation_type(observation_type):
    if observation_type not in ALLOWED_OBSERVATION_TYPES:
        raise ValueError(
            "Invalid observation type. Allowed values are "
            "OCCUPANCY and FAN_MOTION."
        )


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def validate_device(room_id, device_id):
    if device_id is None:
        return

    device = get_device_by_id(device_id)

    if device is None:
        raise ValueError("Device not found.")

    device_room_id = device[1]

    if device_room_id != room_id:
        raise ValueError(
            "Device does not belong to the specified room."
        )


def validate_occupancy_data(observation_data):
    if "occupancy_count" not in observation_data:
        raise ValueError(
            "Occupancy observation must contain occupancy_count."
        )

    occupancy_count = observation_data["occupancy_count"]

    if not isinstance(occupancy_count, int):
        raise ValueError(
            "occupancy_count must be an integer."
        )

    if occupancy_count < 0:
        raise ValueError(
            "occupancy_count cannot be negative."
        )


def validate_fan_motion_data(observation_data):
    if "fan_motion" not in observation_data:
        raise ValueError(
            "Fan motion observation must contain fan_motion."
        )

    fan_motion = observation_data["fan_motion"]

    if not isinstance(fan_motion, dict):
        raise ValueError(
            "fan_motion must be a JSON object."
        )


def validate_observation_data(
    observation_type,
    observation_data
):
    if not isinstance(observation_data, dict):
        raise ValueError(
            "Observation data must be a JSON object."
        )

    if not observation_data:
        raise ValueError(
            "Observation data cannot be empty."
        )

    if observation_type == "OCCUPANCY":
        validate_occupancy_data(observation_data)

    elif observation_type == "FAN_MOTION":
        validate_fan_motion_data(observation_data)


def create_observation(
    room_id,
    device_id,
    observed_at,
    observation_type,
    observation_data
):
    validate_room_exists(room_id)

    validate_device(
        room_id=room_id,
        device_id=device_id
    )

    validate_observation_type(observation_type)

    validate_observation_data(
        observation_type=observation_type,
        observation_data=observation_data
    )

    if observed_at is None:
        observed_at = datetime.now(timezone.utc)

    return create_vision_observation(
        room_id=room_id,
        device_id=device_id,
        observed_at=observed_at,
        observation_type=observation_type,
        observation_data=observation_data
    )


def get_observation(vision_observation_id):
    observation = get_vision_observation_by_id(
        vision_observation_id
    )

    if observation is None:
        raise ValueError(
            "Vision observation not found."
        )

    return observation


def get_room_observations(room_id):
    validate_room_exists(room_id)

    return get_vision_observations_by_room(room_id)


def get_device_observations(device_id):
    device = get_device_by_id(device_id)

    if device is None:
        raise ValueError("Device not found.")

    return get_vision_observations_by_device(device_id)


def get_latest_observation(
    room_id,
    observation_type=None
):
    validate_room_exists(room_id)

    if observation_type is not None:
        validate_observation_type(observation_type)

    return get_latest_vision_observation(
        room_id=room_id,
        observation_type=observation_type
    )


def get_recent_observations(
    room_id,
    observation_type=None,
    limit=10
):
    validate_room_exists(room_id)

    if observation_type is not None:
        validate_observation_type(observation_type)

    if limit <= 0:
        raise ValueError(
            "Limit must be greater than zero."
        )

    return get_recent_vision_observations(
        room_id=room_id,
        observation_type=observation_type,
        limit=limit
    )