from datetime import datetime, timezone

from database.repositories.sensor_repository import (
    create_sensor_observation,
    get_latest_sensor_observation,
    get_recent_sensor_observations,
    get_sensor_observation_by_id,
    get_sensor_observations_by_device,
    get_sensor_observations_by_room,
)

from database.repositories.device_repository import get_device_by_id
from database.repositories.room_repository import get_room_by_id


ALLOWED_OBSERVATION_TYPES = {
    "ELECTRICAL",
    "ENVIRONMENT",
    "LIGHT",
    "ENERGY",
}


def validate_observation_type(observation_type):
    if observation_type not in ALLOWED_OBSERVATION_TYPES:
        raise ValueError(
            "Invalid observation type. Allowed values are "
            "ELECTRICAL, ENVIRONMENT, LIGHT, and ENERGY."
        )


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def validate_device(
    room_id,
    device_id
):
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


def validate_observation_data(
    observation_type,
    observation_data
):
    if not isinstance(observation_data, dict):
        raise ValueError("Observation data must be a JSON object.")

    if not observation_data:
        raise ValueError("Observation data cannot be empty.")

    if observation_type == "ELECTRICAL":
        validate_electrical_data(observation_data)

    elif observation_type == "ENVIRONMENT":
        validate_environment_data(observation_data)

    elif observation_type == "LIGHT":
        validate_light_data(observation_data)

    elif observation_type == "ENERGY":
        validate_energy_data(observation_data)


def validate_electrical_data(data):
    allowed_fields = {
        "voltage",
        "current",
        "power",
        "power_factor",
        "energy",
        "fan_current",
    }

    if not any(field in data for field in allowed_fields):
        raise ValueError(
            "Electrical observation must contain at least one "
            "valid electrical measurement."
        )


def validate_environment_data(data):
    allowed_fields = {
        "temperature",
        "humidity",
    }

    if not any(field in data for field in allowed_fields):
        raise ValueError(
            "Environment observation must contain temperature "
            "or humidity."
        )


def validate_light_data(data):
    if "light_state" not in data:
        raise ValueError(
            "Light observation must contain light_state."
        )

    if data["light_state"] not in {"ON", "OFF"}:
        raise ValueError(
            "light_state must be either ON or OFF."
        )


def validate_energy_data(data):
    allowed_fields = {
        "energy",
        "power",
    }

    if not any(field in data for field in allowed_fields):
        raise ValueError(
            "Energy observation must contain energy or power."
        )


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

    return create_sensor_observation(
        room_id=room_id,
        device_id=device_id,
        observed_at=observed_at,
        observation_type=observation_type,
        observation_data=observation_data
    )


def get_observation(observation_id):
    observation = get_sensor_observation_by_id(
        observation_id
    )

    if observation is None:
        raise ValueError("Sensor observation not found.")

    return observation


def get_room_observations(room_id):
    validate_room_exists(room_id)

    return get_sensor_observations_by_room(room_id)


def get_device_observations(device_id):
    device = get_device_by_id(device_id)

    if device is None:
        raise ValueError("Device not found.")

    return get_sensor_observations_by_device(device_id)


def get_latest_observation(
    room_id,
    observation_type=None
):
    validate_room_exists(room_id)

    if observation_type is not None:
        validate_observation_type(observation_type)

    return get_latest_sensor_observation(
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
        raise ValueError("Limit must be greater than zero.")

    return get_recent_sensor_observations(
        room_id=room_id,
        observation_type=observation_type,
        limit=limit
    )