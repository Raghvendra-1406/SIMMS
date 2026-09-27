from fastapi import APIRouter, HTTPException, status, Depends

from dependencies.auth_dependencies import require_admin

from schemas.vision_calibration_schema import (
    VisionCalibrationData,
)

from services.vision_calibration_service import (
    create_vision_calibration,
    get_active_vision_calibration,
)


router = APIRouter(
    prefix="/vision/calibration",
    tags=["Vision Calibration"]
)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED
)
def create_calibration(
    room_id: int,
    image_path: str,
    calibration_data: VisionCalibrationData,
    current_user=Depends(require_admin)
):
    try:
        created_calibration = create_vision_calibration(
            room_id=room_id,
            image_path=image_path,
            calibration_data=calibration_data.model_dump(),
            created_by=current_user["user_id"]
        )

        return {
            "message": "Vision calibration created successfully.",
            "data": created_calibration
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.get(
    "/room/{room_id}/active"
)
def get_active_calibration(
    room_id: int
):
    try:
        calibration = get_active_vision_calibration(
            room_id
        )

        if calibration is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active vision calibration found."
            )

        return {
            "message": "Active vision calibration retrieved successfully.",
            "data": calibration
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )