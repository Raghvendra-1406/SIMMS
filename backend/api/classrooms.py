from fastapi import APIRouter, Depends, HTTPException, status

from schemas.room_schema import (
    RoomCreate,
    RoomResponse,
    RoomUpdate,
)

from services.room_service import (
    add_room,
    deactivate_room,
    edit_room,
    get_room,
    get_rooms,
    remove_room,
)

from dependencies.auth_dependencies import (
    require_admin,
    get_current_user,
)


router = APIRouter(
    prefix="/classrooms",
    tags=["Classrooms"]
)


@router.post(
    "",
    response_model=RoomResponse,
    status_code=status.HTTP_201_CREATED
)
def create_classroom(
    room: RoomCreate,
    current_user=Depends(require_admin)
):
    try:
        created_room = add_room(
            room_name=room.room_name,
            room_type=room.room_type,
            building=room.building,
            floor=room.floor,
            capacity=room.capacity,
            status=room.status
        )

        return {
            "room_id": created_room[0],
            "room_name": created_room[1],
            "room_type": created_room[2],
            "building": created_room[3],
            "floor": created_room[4],
            "capacity": created_room[5],
            "status": created_room[6],
            "created_at": created_room[7]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.get(
    "",
    response_model=list[RoomResponse]
)
def get_classrooms(
    current_user=Depends(get_current_user)
):
    rooms = get_rooms()

    return [
        {
            "room_id": room[0],
            "room_name": room[1],
            "room_type": room[2],
            "building": room[3],
            "floor": room[4],
            "capacity": room[5],
            "status": room[6],
            "created_at": room[7]
        }
        for room in rooms
    ]


@router.get(
    "/{room_id}",
    response_model=RoomResponse
)
def get_classroom(
    room_id: int,
    current_user=Depends(get_current_user)
):
    try:
        room = get_room(room_id)

        return {
            "room_id": room[0],
            "room_name": room[1],
            "room_type": room[2],
            "building": room[3],
            "floor": room[4],
            "capacity": room[5],
            "status": room[6],
            "created_at": room[7]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


@router.put(
    "/{room_id}",
    response_model=RoomResponse
)
def update_classroom(
    room_id: int,
    room: RoomUpdate,
    current_user=Depends(require_admin)
):
    try:
        updated_room = edit_room(
            room_id=room_id,
            room_name=room.room_name,
            room_type=room.room_type,
            building=room.building,
            floor=room.floor,
            capacity=room.capacity,
            status=room.status
        )

        return {
            "room_id": updated_room[0],
            "room_name": updated_room[1],
            "room_type": updated_room[2],
            "building": updated_room[3],
            "floor": updated_room[4],
            "capacity": updated_room[5],
            "status": updated_room[6],
            "created_at": updated_room[7]
        }

    except ValueError as exc:
        if str(exc) == "Room not found.":
            error_status = status.HTTP_404_NOT_FOUND
        else:
            error_status = status.HTTP_400_BAD_REQUEST

        raise HTTPException(
            status_code=error_status,
            detail=str(exc)
        )


@router.patch(
    "/{room_id}/deactivate",
    response_model=RoomResponse
)
def deactivate_classroom(
    room_id: int,
    current_user=Depends(require_admin)
):
    try:
        deactivated_room = deactivate_room(room_id)

        return {
            "room_id": deactivated_room[0],
            "room_name": deactivated_room[1],
            "room_type": deactivated_room[2],
            "building": deactivated_room[3],
            "floor": deactivated_room[4],
            "capacity": deactivated_room[5],
            "status": deactivated_room[6],
            "created_at": deactivated_room[7]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


@router.delete(
    "/{room_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_classroom(
    room_id: int,
    current_user=Depends(require_admin)
):
    try:
        remove_room(room_id)

        return None

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )

