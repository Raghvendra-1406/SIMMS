from fastapi import APIRouter, HTTPException, status, Depends

from schemas.device_schema import (
    DeviceCreate,
    DeviceResponse,
    DeviceStatusUpdate,
    DeviceUpdate,
)

from services.device_service import (
    activate_device,
    add_device,
    deactivate_device,
    edit_device,
    get_device,
    get_devices,
    get_room_devices,
    mark_device_seen,
)

from dependencies.auth_dependencies import (
    get_current_user,
    require_admin,
)

router = APIRouter(
    prefix="/devices",
    tags=["Devices"]
)


@router.post(
    "",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED
)
def create_device_endpoint(
    device: DeviceCreate,
    current_user=Depends(require_admin)
):
    try:
        created_device = add_device(
            room_id=device.room_id,
            device_type=device.device_type,
            device_name=device.device_name,
            status=device.status
        )

        return {
            "device_id": created_device[0],
            "room_id": created_device[1],
            "device_type": created_device[2],
            "device_name": created_device[3],
            "status": created_device[4],
            "last_seen": created_device[5],
            "created_at": created_device[6]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.get(
    "",
    response_model=list[DeviceResponse]
)
def get_all_devices_endpoint(
    current_user=Depends(get_current_user)
):
    devices = get_devices()

    return [
        {
            "device_id": device[0],
            "room_id": device[1],
            "device_type": device[2],
            "device_name": device[3],
            "status": device[4],
            "last_seen": device[5],
            "created_at": device[6]
        }
        for device in devices
    ]


@router.get(
    "/room/{room_id}",
    response_model=list[DeviceResponse]
)
def get_devices_for_room(
    room_id: int,
    current_user=Depends(get_current_user)
):
    try:
        devices = get_room_devices(room_id)

        return [
            {
                "device_id": device[0],
                "room_id": device[1],
                "device_type": device[2],
                "device_name": device[3],
                "status": device[4],
                "last_seen": device[5],
                "created_at": device[6]
            }
            for device in devices
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


@router.get(
    "/{device_id}",
    response_model=DeviceResponse
)
def get_device_endpoint(
    device_id: int,
    current_user=Depends(get_current_user)
):
    try:
        device = get_device(device_id)

        return {
            "device_id": device[0],
            "room_id": device[1],
            "device_type": device[2],
            "device_name": device[3],
            "status": device[4],
            "last_seen": device[5],
            "created_at": device[6]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


@router.put(
    "/{device_id}",
    response_model=DeviceResponse
)
def update_device_endpoint(
    device_id: int,
    device: DeviceUpdate,
    current_user=Depends(require_admin)
):
    try:
        updated_device = edit_device(
            device_id=device_id,
            room_id=device.room_id,
            device_type=device.device_type,
            device_name=device.device_name,
            status=device.status
        )

        return {
            "device_id": updated_device[0],
            "room_id": updated_device[1],
            "device_type": updated_device[2],
            "device_name": updated_device[3],
            "status": updated_device[4],
            "last_seen": updated_device[5],
            "created_at": updated_device[6]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
                if str(exc) == "Device not found."
                else status.HTTP_400_BAD_REQUEST
            ),
            detail=str(exc)
        )


@router.patch(
    "/{device_id}/status",
    response_model=DeviceResponse
)
def update_device_status_endpoint(
    device_id: int,
    device_status: DeviceStatusUpdate,
    current_user=Depends(require_admin)
):
    try:
        if device_status.status == "ACTIVE":
            updated_device = activate_device(device_id)

        elif device_status.status == "INACTIVE":
            updated_device = deactivate_device(device_id)

        else:
            raise ValueError(
                "Invalid device status. Allowed values are ACTIVE and INACTIVE."
            )

        return {
            "device_id": updated_device[0],
            "room_id": updated_device[1],
            "device_type": updated_device[2],
            "device_name": updated_device[3],
            "status": updated_device[4],
            "last_seen": updated_device[5],
            "created_at": updated_device[6]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
                if str(exc) == "Device not found."
                else status.HTTP_400_BAD_REQUEST
            ),
            detail=str(exc)
        )


@router.patch(
    "/{device_id}/seen",
    response_model=DeviceResponse
)
def mark_device_seen_endpoint(device_id: int):
    try:
        updated_device = mark_device_seen(device_id)

        return {
            "device_id": updated_device[0],
            "room_id": updated_device[1],
            "device_type": updated_device[2],
            "device_name": updated_device[3],
            "status": updated_device[4],
            "last_seen": updated_device[5],
            "created_at": updated_device[6]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )