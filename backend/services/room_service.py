from database.repositories.room_repository import (
    create_room,
    delete_room,
    get_all_rooms,
    get_room_by_id,
    update_room,
)


ALLOWED_ROOM_TYPES = {
    "CLASSROOM",
    "LAB",
}


ALLOWED_ROOM_STATUSES = {
    "ACTIVE",
    "INACTIVE",
}


def validate_room_type(room_type):
    if room_type not in ALLOWED_ROOM_TYPES:
        raise ValueError(
            "Invalid room type. Allowed values are CLASSROOM and LAB."
        )


def validate_room_status(status):
    if status not in ALLOWED_ROOM_STATUSES:
        raise ValueError(
            "Invalid room status. Allowed values are ACTIVE and INACTIVE."
        )


def validate_room_data(
    room_name,
    room_type,
    building=None,
    floor=None,
    capacity=None,
    status="ACTIVE"
):
    if not room_name or not room_name.strip():
        raise ValueError("Room name cannot be empty.")

    validate_room_type(room_type)
    validate_room_status(status)

    if floor is not None and floor < 0:
        raise ValueError("Floor cannot be negative.")

    if capacity is not None and capacity <= 0:
        raise ValueError("Capacity must be greater than zero.")


def get_rooms():
    return get_all_rooms()


def get_room(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def add_room(
    room_name,
    room_type,
    building=None,
    floor=None,
    capacity=None,
    status="ACTIVE"
):
    validate_room_data(
        room_name=room_name,
        room_type=room_type,
        building=building,
        floor=floor,
        capacity=capacity,
        status=status
    )

    existing_rooms = get_all_rooms()

    for room in existing_rooms:
        if room[1].lower() == room_name.strip().lower():
            raise ValueError(
                "A room with this name already exists."
            )

    return create_room(
        room_name=room_name.strip(),
        room_type=room_type,
        building=building,
        floor=floor,
        capacity=capacity,
        status=status
    )


def edit_room(
    room_id,
    room_name,
    room_type,
    building=None,
    floor=None,
    capacity=None,
    status="ACTIVE"
):
    get_room(room_id)

    validate_room_data(
        room_name=room_name,
        room_type=room_type,
        building=building,
        floor=floor,
        capacity=capacity,
        status=status
    )

    existing_rooms = get_all_rooms()

    for room in existing_rooms:
        if room[0] != room_id:
            if room[1].lower() == room_name.strip().lower():
                raise ValueError(
                    "Another room with this name already exists."
                )

    return update_room(
        room_id=room_id,
        room_name=room_name.strip(),
        room_type=room_type,
        building=building,
        floor=floor,
        capacity=capacity,
        status=status
    )


def deactivate_room(room_id):
    room = get_room(room_id)

    return update_room(
        room_id=room_id,
        room_name=room[1],
        room_type=room[2],
        building=room[3],
        floor=room[4],
        capacity=room[5],
        status="INACTIVE"
    )


def remove_room(room_id):
    get_room(room_id)

    return delete_room(room_id)