from fastapi import APIRouter, Depends, HTTPException, status

from schemas.room_schema import (
    CircuitBaselineUpdate,
    CircuitLearn,
    RoomCommand,
    RoomCreate,
    StandardDevicesCreate,
    RoomResponse,
    RoomUpdate,
)

from mqtt.subscriber import (
    publish_command,
)

from database.connection import (
    transaction,
)

from services.device_service import (
    add_standard_devices,
)

from services.circuit_service import (
    UNIT_CIRCUITS,
    evaluate_circuit,
    learn_baseline,
    set_baseline,
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
    require_admin_or_supervisor,
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
        # Room and its devices are created together, or not at all.
        with transaction():
            created_room = add_room(
                room_name=room.room_name,
                room_type=room.room_type,
                building=room.building,
                floor=room.floor,
                capacity=room.capacity,
                status=room.status
            )

            devices = add_standard_devices(
                room_id=created_room[0],
                fan_count=room.fan_count,
                light_count=room.light_count,
                include_nodes=room.add_node_devices
            )

        return {
            "devices_created": len(devices),
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


@router.post(
    "/{room_id}/commands",
    status_code=status.HTTP_202_ACCEPTED
)
def send_classroom_command(
    room_id: int,
    command: RoomCommand,
    current_user=Depends(require_admin_or_supervisor)
):
    """
    Switch the room's demo-panel LIGHTS or FANS circuit relay.
    The node applies it and reports the new relay state in its
    next status message, which the live monitor then shows.
    """

    try:
        room = get_room(room_id)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )

    payload = {
        "target": command.target,
        "state": command.state,
        "requested_by": current_user["user_id"],
    }

    try:
        publish_command(room[1], payload)

    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc)
        )

    return {
        "message": "Command sent to the classroom node.",
        "room_name": room[1],
        "command": payload,
    }


# ---------------------------------------------------------
# CIRCUITS (per-unit current baselines)
# ---------------------------------------------------------

def _require_room(room_id):
    try:
        return get_room(room_id)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


@router.get("/{room_id}/circuits")
def get_classroom_circuits(
    room_id: int,
    current_user=Depends(get_current_user)
):
    """
    Latest reading of the LIGHTS and FANS circuits, how many units
    are powered, and the per-unit current in use.
    """

    _require_room(room_id)

    return {
        circuit: evaluate_circuit(room_id, circuit)
        for circuit in UNIT_CIRCUITS
    }


@router.post("/{room_id}/circuits/{circuit}/learn")
def learn_classroom_circuit(
    room_id: int,
    circuit: str,
    body: CircuitLearn,
    current_user=Depends(require_admin)
):
    """
    Commissioning: with `units_on` units switched on, learn the
    circuit's per-unit current from the live reading.
    Record units_on = 0 (everything off) first for the standby current.
    """

    _require_room(room_id)

    try:
        return learn_baseline(room_id, circuit.upper(), body.units_on)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.put("/{room_id}/circuits/{circuit}/baseline")
def update_classroom_circuit_baseline(
    room_id: int,
    circuit: str,
    body: CircuitBaselineUpdate,
    current_user=Depends(require_admin)
):
    _require_room(room_id)

    try:
        return set_baseline(
            room_id,
            circuit.upper(),
            body.unit_current_a,
            body.standby_current_a
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.post(
    "/{room_id}/devices/standard",
    status_code=status.HTTP_201_CREATED
)
def add_classroom_standard_devices(
    room_id: int,
    body: StandardDevicesCreate,
    current_user=Depends(require_admin)
):
    """
    Add "Fan 1..N", "Tube 1..N" and optionally the ESP32 node and
    camera to a room. Existing devices (same name) are kept.
    """

    try:
        with transaction():
            devices = add_standard_devices(
                room_id=room_id,
                fan_count=body.fan_count,
                light_count=body.light_count,
                include_nodes=body.add_node_devices
            )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )

    return {
        "message": f"{len(devices)} device(s) added.",
        "devices_created": len(devices),
    }
