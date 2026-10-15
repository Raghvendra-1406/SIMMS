from datetime import datetime, timezone

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
        last_seen=datetime.now(timezone.utc)
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

# Standard devices of a metered classroom (names the firmware and the
# vision runtime use: "Fan 1".."Fan N", "Tube 1".."Tube N").
NODE_DEVICES = [
    ("SENSOR_NODE", "ESP32 Node"),
    ("CAMERA", "Camera"),
]


def add_standard_devices(
    room_id,
    fan_count=0,
    light_count=0,
    include_nodes=True
):
    """
    Create the room's fans, tube lights and (optionally) its ESP32
    node and camera. Devices that already exist by name are kept, so
    this is safe to run again, e.g. to add more fans later.

    Returns the list of created device rows.
    """

    validate_room_exists(room_id)

    if not 0 <= fan_count <= 50 or not 0 <= light_count <= 50:
        raise ValueError(
            "Fan and tube-light counts must be between 0 and 50."
        )

    wanted = [
        *[("FAN", f"Fan {n}") for n in range(1, fan_count + 1)],
        *[("LIGHT", f"Tube {n}") for n in range(1, light_count + 1)],
        *(NODE_DEVICES if include_nodes else []),
    ]

    existing_names = {
        str(device[3]).strip().lower()
        for device in get_devices_by_room(room_id)
    }

    created = []

    for device_type, device_name in wanted:
        if device_name.lower() in existing_names:
            continue

        created.append(
            create_device(
                room_id=room_id,
                device_type=device_type,
                device_name=device_name,
                status="ACTIVE"
            )
        )

    return created
