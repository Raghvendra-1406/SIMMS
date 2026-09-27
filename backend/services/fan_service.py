from database.repositories.sensor_repository import (
    get_latest_sensor_observation,
)

from database.repositories.vision_repository import (
    get_latest_device_vision_observation,
)

from database.repositories.device_repository import (
    get_device_by_id,
)

from database.repositories.room_repository import (
    get_room_by_id,
)


FAN_FAILURE_THRESHOLD = 4


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def validate_device_exists(device_id):
    device = get_device_by_id(device_id)

    if device is None:
        raise ValueError("Device not found.")

    return device


def validate_device_belongs_to_room(room_id, device_id):
    device = validate_device_exists(device_id)

    if device[1] != room_id:
        raise ValueError(
            "Device does not belong to the specified room."
        )

    return device


def get_latest_electrical_observation(room_id):
    return get_latest_sensor_observation(
        room_id=room_id,
        observation_type="ELECTRICAL"
    )


def get_latest_fan_motion_observation(device_id):
    # The vision runtime publishes one FAN_MOTION message per fan,
    # so the latest row must be looked up per device, not per room.
    return get_latest_device_vision_observation(
        device_id=device_id,
        observation_type="FAN_MOTION"
    )


def extract_fan_current(observation):
    if observation is None:
        return None

    observation_data = observation[5]

    return observation_data.get("fan_current")


def extract_fan_motion(observation):
    """
    Read the running flag from a FAN_MOTION observation.

    The vision runtime publishes:
        {"fan_motion": {"running", "motion_score", "confidence"}}

    confidence == 0 means the detector had no usable frame
    (first frame after start-up or an invalid ROI), so the
    observation is treated as unknown rather than "not running".
    """

    if observation is None:
        return None

    observation_data = observation[5]

    fan_motion = observation_data.get("fan_motion")

    if not isinstance(fan_motion, dict):
        return None

    running = fan_motion.get("running")

    if running is None:
        return None

    if not fan_motion.get("confidence"):
        return None

    return bool(running)


def evaluate_fan_status(
    room_id,
    device_id
):
    validate_room_exists(room_id)

    validate_device_belongs_to_room(
        room_id=room_id,
        device_id=device_id
    )

    electrical_observation = get_latest_electrical_observation(
        room_id
    )

    vision_observation = get_latest_fan_motion_observation(
        device_id
    )

    fan_current = extract_fan_current(
        electrical_observation
    )

    fan_motion = extract_fan_motion(
        vision_observation
    )

    if fan_current is None or fan_motion is None:
        return {
            "status": "UNKNOWN",
            "fan_current": fan_current,
            "fan_motion": fan_motion,
        }

    if fan_current <= 0 and not fan_motion:
        return {
            "status": "OFF",
            "fan_current": fan_current,
            "fan_motion": fan_motion,
        }

    if fan_current > 0 and fan_motion:
        return {
            "status": "WORKING",
            "fan_current": fan_current,
            "fan_motion": fan_motion,
        }

    if fan_current > 0 and not fan_motion:
        return {
            "status": "FAILURE_CANDIDATE",
            "fan_current": fan_current,
            "fan_motion": fan_motion,
        }

    if fan_current <= 0 and fan_motion:
        return {
            "status": "ABNORMAL",
            "fan_current": fan_current,
            "fan_motion": fan_motion,
        }

    return {
        "status": "UNKNOWN",
        "fan_current": fan_current,
        "fan_motion": fan_motion,
    }


def is_fan_failure_candidate(
    room_id,
    device_id
):
    result = evaluate_fan_status(
        room_id=room_id,
        device_id=device_id
    )

    return result["status"] == "FAILURE_CANDIDATE"


def confirm_fan_failure(
    abnormal_count
):
    return abnormal_count >= FAN_FAILURE_THRESHOLD