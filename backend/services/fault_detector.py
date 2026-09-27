from datetime import datetime, timezone

from database.repositories.fault_repository import (
    create_fault_event,
    get_active_faults_by_room,
    confirm_fault,
)

from database.repositories.device_repository import (
    get_device_by_id,
)

from database.repositories.room_repository import (
    get_room_by_id,
)

from services.fan_service import (
    evaluate_fan_status,
    FAN_FAILURE_THRESHOLD,
)

from services.light_service import (
    evaluate_light_status,
    LIGHT_WASTAGE_THRESHOLD,
)

from services.electrical_service import (
    evaluate_electrical_status,
    ELECTRICAL_ABNORMALITY_THRESHOLD,
)


FAULT_FAN_FAILURE = "FAN_FAILURE"
FAULT_LIGHTS_LEFT_ON = "LIGHTS_LEFT_ON"
FAULT_ELECTRICAL_ABNORMALITY = "ELECTRICAL_ABNORMALITY"


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


def get_active_fault(
    room_id,
    fault_type,
    device_id=None
):
    active_faults = get_active_faults_by_room(room_id)

    for fault in active_faults:
        fault_device_id = fault[2]
        current_fault_type = fault[3]

        if current_fault_type != fault_type:
            continue

        if fault_device_id == device_id:
            return fault

    return None


def create_confirmed_fault(
    room_id,
    device_id,
    fault_type,
    confidence=None,
    abnormal_count=None
):
    existing_fault = get_active_fault(
        room_id=room_id,
        fault_type=fault_type,
        device_id=device_id
    )

    if existing_fault is not None:
        return existing_fault

    detected_at = datetime.now(timezone.utc)

    fault = create_fault_event(
        room_id=room_id,
        device_id=device_id,
        fault_type=fault_type,
        detected_at=detected_at,
        confidence=confidence,
        abnormal_count=abnormal_count
    )

    confirmed_fault = confirm_fault(
        fault_id=fault[0],
        confirmed_at=datetime.now(timezone.utc)
    )

    return confirmed_fault


def detect_fan_failure(
    room_id,
    device_id,
    abnormal_count
):
    validate_room_exists(room_id)

    validate_device_belongs_to_room(
        room_id=room_id,
        device_id=device_id
    )

    result = evaluate_fan_status(
        room_id=room_id,
        device_id=device_id
    )

    if result["status"] != "FAILURE_CANDIDATE":
        return None

    if abnormal_count < FAN_FAILURE_THRESHOLD:
        return None

    return create_confirmed_fault(
        room_id=room_id,
        device_id=device_id,
        fault_type=FAULT_FAN_FAILURE,
        confidence=100.0,
        abnormal_count=abnormal_count
    )


def detect_light_wastage(
    room_id,
    abnormal_count
):
    validate_room_exists(room_id)

    result = evaluate_light_status(
        room_id=room_id
    )

    if result["status"] != "WASTAGE_CANDIDATE":
        return None

    if abnormal_count < LIGHT_WASTAGE_THRESHOLD:
        return None

    return create_confirmed_fault(
        room_id=room_id,
        device_id=None,
        fault_type=FAULT_LIGHTS_LEFT_ON,
        confidence=100.0,
        abnormal_count=abnormal_count
    )


def detect_electrical_abnormality(
    room_id,
    abnormal_count,
    confidence=None
):
    validate_room_exists(room_id)

    result = evaluate_electrical_status(
        room_id=room_id
    )

    if result["status"] != "ABNORMALITY_CANDIDATE":
        return None

    if abnormal_count < ELECTRICAL_ABNORMALITY_THRESHOLD:
        return None

    if confidence is None:
        confidence = 100.0

    return create_confirmed_fault(
        room_id=room_id,
        device_id=None,
        fault_type=FAULT_ELECTRICAL_ABNORMALITY,
        confidence=confidence,
        abnormal_count=abnormal_count
    )


def detect_fault(
    fault_type,
    room_id,
    device_id=None,
    abnormal_count=0,
    confidence=None
):
    if fault_type == FAULT_FAN_FAILURE:
        if device_id is None:
            raise ValueError(
                "Device ID is required for fan failure detection."
            )

        return detect_fan_failure(
            room_id=room_id,
            device_id=device_id,
            abnormal_count=abnormal_count
        )

    if fault_type == FAULT_LIGHTS_LEFT_ON:
        return detect_light_wastage(
            room_id=room_id,
            abnormal_count=abnormal_count
        )

    if fault_type == FAULT_ELECTRICAL_ABNORMALITY:
        return detect_electrical_abnormality(
            room_id=room_id,
            abnormal_count=abnormal_count,
            confidence=confidence
        )

    raise ValueError(
        "Unsupported fault type."
    )