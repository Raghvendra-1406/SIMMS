from datetime import datetime

from database.repositories.device_repository import (
    create_device,
    get_all_devices,
    get_device_by_id,
    get_devices_by_room,
    update_device,
    update_device_last_seen,
    update_device_status,
)

from database.repositories.room_repository import get_room_by_id


ALLOWED_DEVICE_STATUSES = {
    "ACTIVE",
    "INACTIVE",
}


def validate_device_status(status):
    if status not in ALLOWED_DEVICE_STATUSES:
        raise ValueError(
            "Invalid device status. Allowed values are ACTIVE and INACTIVE."
        )


def validate_device_data(
    room_id,
    device_type,
    device_name,
    status="ACTIVE"
):
    if room_id <= 0:
        raise ValueError("Room ID must be greater than zero.")

    if not device_type or not device_type.strip():
        raise ValueError("Device type cannot be empty.")

    if not device_name or not device_name.strip():
        raise ValueError("Device name cannot be empty.")

    validate_device_status(status)


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def get_devices():
    return get_all_devices()


def get_device(device_id):
    device = get_device_by_id(device_id)

    if device is None:
        raise ValueError("Device not found.")

    return device


def get_room_devices(room_id):
    validate_room_exists(room_id)

    return get_devices_by_room(room_id)


def add_device(
    room_id,
    device_type,
    device_name,
    status="ACTIVE"
):
    validate_device_data(
        room_id=room_id,
        device_type=device_type,
        device_name=device_name,
        status=status
    )

    validate_room_exists(room_id)

    existing_devices = get_devices_by_room(room_id)

    for device in existing_devices:
        if device[3].lower() == device_name.strip().lower():
            raise ValueError(
                "A device with this name already exists in this room."
            )

    return create_device(
        room_id=room_id,
        device_type=device_type.strip(),
        device_name=device_name.strip(),
        status=status
    )


def edit_device(
    device_id,
    room_id,
    device_type,
    device_name,
    status="ACTIVE"
):
    get_device(device_id)

    validate_device_data(
        room_id=room_id,
        device_type=device_type,
        device_name=device_name,
        status=status
    )

    validate_room_exists(room_id)

    existing_devices = get_devices_by_room(room_id)

    for device in existing_devices:
        if device[0] != device_id:
            if device[3].lower() == device_name.strip().lower():
                raise ValueError(
                    "Another device with this name already exists in this room."
                )

    return update_device(
        device_id=device_id,
        room_id=room_id,
        device_type=device_type.strip(),
        device_name=device_name.strip(),
        status=status
    )


def change_device_status(device_id, status):
    get_device(device_id)

    validate_device_status(status)

    return update_device_status(
        device_id=device_id,
        status=status
    )


def mark_device_seen(device_id):
    get_device(device_id)

    return update_device_last_seen(
        device_id=device_id,
        last_seen=datetime.now()
    )


def deactivate_device(device_id):
    return change_device_status(
        device_id=device_id,
        status="INACTIVE"
    )


def activate_device(device_id):
    return change_device_status(
        device_id=device_id,
        status="ACTIVE"
    )