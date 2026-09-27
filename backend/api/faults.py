from fastapi import APIRouter, HTTPException, status

from schemas.fault_schema import (
    FaultEventCreate,
    FaultEventResponse,
    FaultStatusUpdate,
)

from services.fault_detector import (
    FAULT_FAN_FAILURE,
    FAULT_LIGHTS_LEFT_ON,
    FAULT_ELECTRICAL_ABNORMALITY,
    detect_fault,
)

from services.fault_service import (
    get_fault,
    get_room_faults,
    get_active_room_faults,
    get_active_fault_events,
    change_fault_status,
)


router = APIRouter(
    prefix="/faults",
    tags=["Fault Events"]
)


ALLOWED_FAULT_TYPES = {
    FAULT_FAN_FAILURE,
    FAULT_LIGHTS_LEFT_ON,
    FAULT_ELECTRICAL_ABNORMALITY,
}


def fault_to_response(fault):
    return {
        "fault_id": fault[0],
        "room_id": fault[1],
        "device_id": fault[2],
        "fault_type": fault[3],
        "detected_at": fault[4],
        "confirmed_at": fault[5],
        "status": fault[6],
        "confidence": fault[7],
        "abnormal_count": fault[8],
        "created_at": fault[10]
    }


@router.post(
    "/detect",
    response_model=FaultEventResponse
)
def detect_fault_endpoint(
    fault: FaultEventCreate
):
    if fault.fault_type not in ALLOWED_FAULT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported fault type."
        )

    try:
        detected_fault = detect_fault(
            fault_type=fault.fault_type,
            room_id=fault.room_id,
            device_id=fault.device_id,
            abnormal_count=fault.abnormal_count or 0,
            confidence=fault.confidence
        )

        if detected_fault is None:
            raise HTTPException(
                status_code=status.HTTP_200_OK,
                detail="Fault candidate not confirmed."
            )

        return fault_to_response(detected_fault)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.get(
    "/active",
    response_model=list[FaultEventResponse]
)
def get_all_active_faults_endpoint():
    faults = get_active_fault_events()

    return [
        fault_to_response(fault)
        for fault in faults
    ]


@router.get(
    "/room/{room_id}/active",
    response_model=list[FaultEventResponse]
)
def get_active_faults_for_room(
    room_id: int
):
    try:
        faults = get_active_room_faults(room_id)

        return [
            fault_to_response(fault)
            for fault in faults
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


@router.get(
    "/room/{room_id}",
    response_model=list[FaultEventResponse]
)
def get_faults_for_room(
    room_id: int
):
    try:
        faults = get_room_faults(room_id)

        return [
            fault_to_response(fault)
            for fault in faults
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


@router.get(
    "/{fault_id}",
    response_model=FaultEventResponse
)
def get_fault_endpoint(
    fault_id: int
):
    try:
        fault = get_fault(fault_id)

        return fault_to_response(fault)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


@router.patch(
    "/{fault_id}/status",
    response_model=FaultEventResponse
)
def update_fault_status_endpoint(
    fault_id: int,
    fault_status: FaultStatusUpdate
):
    try:
        updated_fault = change_fault_status(
            fault_id=fault_id,
            status=fault_status.status
        )

        return fault_to_response(updated_fault)

    except ValueError as exc:
        if str(exc) == "Fault event not found.":
            error_status = status.HTTP_404_NOT_FOUND
        else:
            error_status = status.HTTP_400_BAD_REQUEST

        raise HTTPException(
            status_code=error_status,
            detail=str(exc)
        )   