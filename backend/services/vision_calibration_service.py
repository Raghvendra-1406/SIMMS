from database.repositories.vision_calibration_repository import (
    create_calibration,
    room_exists,
    device_belongs_to_room,
    get_next_calibration_version,
    deactivate_room_calibrations,
    get_active_calibration,
)


def create_vision_calibration(
    room_id,
    image_path,
    calibration_data,
    created_by
):
    if not room_exists(room_id):
        raise ValueError(
            "Room does not exist."
        )

    fans = calibration_data.get("fans") or []
    seats = calibration_data.get("seats") or []
    board = calibration_data.get("board")

    if not fans and not seats and board is None:
        raise ValueError(
            "Calibration must contain at least one fan, "
            "seat or board region."
        )

    for region in [*fans, *seats, *([board] if board else [])]:
        if region["x2"] <= region["x1"] or region["y2"] <= region["y1"]:
            raise ValueError(
                "Each region must have x2 > x1 and y2 > y1."
            )

    seat_ids = [seat["seat_id"] for seat in seats]

    if len(seat_ids) != len(set(seat_ids)):
        raise ValueError(
            "Seat IDs must be unique."
        )

    for fan in fans:
        device_id = fan["device_id"]

        if not device_belongs_to_room(
            device_id,
            room_id
        ):
            raise ValueError(
                f"Fan device {device_id} does not belong "
                f"to room {room_id}."
            )

    calibration_version = get_next_calibration_version(
        room_id
    )

    deactivate_room_calibrations(
        room_id
    )

    calibration_id = create_calibration(
        room_id=room_id,
        calibration_version=calibration_version,
        image_path=image_path,
        calibration_data=calibration_data,
        created_by=created_by
    )

    return {
        "calibration_id": calibration_id,
        "room_id": room_id,
        "calibration_version": calibration_version,
        "image_path": image_path,
        "calibration_data": calibration_data,
        "created_by": created_by
    }

def get_active_vision_calibration(room_id):
    if not room_exists(room_id):
        raise ValueError(
            "Room does not exist."
        )

    calibration = get_active_calibration(
        room_id
    )

    if calibration is None:
        return None

    return {
        "calibration_id": calibration[0],
        "room_id": calibration[1],
        "calibration_version": calibration[2],
        "image_path": calibration[3],
        "calibration_data": calibration[4],
        "created_by": calibration[5],
        "created_at": calibration[6],
        "is_active": calibration[7]
    }