from datetime import datetime, timezone

from database.connection import (
    transaction,
)

from database.repositories.fault_repository import (
    create_fault_event,
    get_active_faults_by_room,
    confirm_fault,
)

from database.repositories.room_repository import (
    get_room_by_id,
)

from services.fault_types import (
    ALL_FAULT_TYPES,
    FAULT_BOARD_NEEDS_CLEANING,
    FAULT_ELECTRICAL_ABNORMALITY,
    FAULT_ENERGY_WASTAGE,
    FAULT_FAN_FAILURE,
    FAULT_LIGHT_FAILURE,
    FAULT_LIGHTS_LEFT_ON,
)

# Re-exported for older imports.
__all__ = [
    "FAULT_BOARD_NEEDS_CLEANING",
    "FAULT_ELECTRICAL_ABNORMALITY",
    "FAULT_ENERGY_WASTAGE",
    "FAULT_FAN_FAILURE",
    "FAULT_LIGHT_FAILURE",
    "FAULT_LIGHTS_LEFT_ON",
    "create_confirmed_fault",
    "detect_fault",
    "get_active_fault",
]


# Faults confirmed through /faults/detect need the same evidence as
# the automatic path: 4 of the last 5 observations abnormal.
MANUAL_CONFIRMATION_THRESHOLD = 4


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def get_active_fault(
    room_id,
    fault_type,
    device_id=None
):
    for fault in get_active_faults_by_room(room_id):
        if fault[3] == fault_type and fault[2] == device_id:
            return fault

    return None


def create_confirmed_fault(
    room_id,
    device_id,
    fault_type,
    confidence=None,
    abnormal_count=None,
    recurrence_type=None,
    details=None,
    detected_at=None
):
    existing_fault = get_active_fault(
        room_id=room_id,
        fault_type=fault_type,
        device_id=device_id
    )

    if existing_fault is not None:
        return existing_fault

    # detected_at = onset of the abnormal run (first abnormal vote);
    # confirmed_at = now. The gap is the confirmation delay.
    detected_at = detected_at or datetime.now(timezone.utc)

    with transaction():
        fault = create_fault_event(
            room_id=room_id,
            device_id=device_id,
            fault_type=fault_type,
            detected_at=detected_at,
            confidence=confidence,
            abnormal_count=abnormal_count,
            recurrence_type=recurrence_type,
            details=details
        )

        confirmed_fault = confirm_fault(
            fault_id=fault[0],
            confirmed_at=datetime.now(timezone.utc)
        )

    return confirmed_fault


def detect_fault(
    fault_type,
    room_id,
    device_id=None,
    abnormal_count=0,
    confidence=None
):
    """
    Manually confirm a fault (admin /faults/detect), after checking
    that the room's current readings really show it.
    """

    # Imported here: the condition checks import this module.
    from services.fault_conditions import current_condition

    if fault_type not in ALL_FAULT_TYPES:
        raise ValueError("Unsupported fault type.")

    validate_room_exists(room_id)

    if abnormal_count < MANUAL_CONFIRMATION_THRESHOLD:
        return None

    abnormal, details = current_condition(
        fault_type=fault_type,
        room_id=room_id,
        device_id=device_id
    )

    if not abnormal:
        return None

    return create_confirmed_fault(
        room_id=room_id,
        device_id=device_id,
        fault_type=fault_type,
        confidence=confidence if confidence is not None else 100.0,
        abnormal_count=abnormal_count,
        details=details
    )
