from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth_dependencies import (
    get_current_user,
)

from database.repositories.live_repository import (
    get_live_rooms,
)

from mqtt.subscriber import (
    is_connected,
)


router = APIRouter(
    prefix="/live",
    tags=["Live Monitoring"],
    dependencies=[Depends(get_current_user)]
)


@router.get("/rooms")
def live_rooms():
    """
    Latest state of every room in one call, for the live monitor:
    readings, fan motion, node status, active faults and health.
    """

    return {
        "mqtt_connected": is_connected(),
        "rooms": get_live_rooms(),
    }


@router.get("/rooms/{room_id}")
def live_room(room_id: int):
    rooms = get_live_rooms(room_id)

    if not rooms:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found."
        )

    return {
        "mqtt_connected": is_connected(),
        "room": rooms[0],
    }
