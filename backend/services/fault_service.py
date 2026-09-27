from database.repositories.fault_repository import (
    get_fault_by_id,
    get_faults_by_room,
    get_active_faults_by_room,
    get_all_active_faults,
    update_fault_status,
)

from database.repositories.room_repository import (
    get_room_by_id,
)


ALLOWED_FAULT_STATUSES = {
    "OPEN",
    "RESOLVED",
    "REOPENED",
    "CLOSED",
}


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def validate_fault_status(status):
    if status not in ALLOWED_FAULT_STATUSES:
        raise ValueError(
            "Invalid fault status. Allowed values are "
            "OPEN, RESOLVED, REOPENED, and CLOSED."
        )


def get_fault(fault_id):
    fault = get_fault_by_id(fault_id)

    if fault is None:
        raise ValueError("Fault event not found.")

    return fault


def get_room_faults(room_id):
    validate_room_exists(room_id)

    return get_faults_by_room(room_id)


def get_active_room_faults(room_id):
    validate_room_exists(room_id)

    return get_active_faults_by_room(room_id)


def get_active_fault_events():
    return get_all_active_faults()


def change_fault_status(fault_id, status):
    get_fault(fault_id)

    validate_fault_status(status)

    updated_fault = update_fault_status(
        fault_id=fault_id,
        status=status
    )

    return updated_fault