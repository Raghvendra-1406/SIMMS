from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth_dependencies import (
    get_current_user,
)

from services.health_service import (
    get_latest_health_for_all_rooms,
)


router = APIRouter(
    prefix="/health",
    tags=["Health Monitoring"],
    dependencies=[Depends(get_current_user)]
)


@router.get("/classrooms")
def get_classroom_health():
    try:
        health_scores = get_latest_health_for_all_rooms()

        return [
            {
                "room_id": health[1],
                "health_status": health[2],
                "health_score": health[3],
                "active_fault_count": health[4],
                "occupancy_count": health[5],
                "temperature": health[6],
                "humidity": health[7],
                "power": health[8],
                "calculated_at": health[9],
            }
            for health in health_scores
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )