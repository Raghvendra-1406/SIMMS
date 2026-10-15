from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from dependencies.auth_dependencies import (
    require_admin_or_supervisor,
)

from database.repositories.stats_repository import (
    delete_ticket_review,
    upsert_ticket_review,
)

from services.stats_service import get_overview
from services.ticket_service import get_ticket


router = APIRouter(
    prefix="/stats",
    tags=["Statistics"],
    dependencies=[Depends(require_admin_or_supervisor)]
)


class TicketReview(BaseModel):
    verdict: Literal["GENUINE", "FALSE_ALARM"]
    note: Optional[str] = Field(default=None, max_length=500)


# ---------------------------------------------------------
# OVERVIEW (Plan v2 §16.2 evaluation numbers)
# ---------------------------------------------------------

@router.get("/overview")
def stats_overview(
    days: float = Query(default=7, gt=0, le=90),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    room_id: Optional[int] = None,
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
):
    try:
        return get_overview(
            days=days,
            start=start,
            end=end,
            room_id=room_id,
            tz_offset_minutes=tz_offset_minutes
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


# ---------------------------------------------------------
# TICKET REVIEW: genuine fault or false alarm
# ---------------------------------------------------------

@router.put("/tickets/{ticket_id}/review")
def review_ticket(
    ticket_id: int,
    review: TicketReview,
    current_user=Depends(require_admin_or_supervisor)
):
    try:
        get_ticket(ticket_id)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )

    return upsert_ticket_review(
        ticket_id=ticket_id,
        verdict=review.verdict,
        note=(review.note or "").strip() or None,
        reviewed_by=current_user["user_id"]
    )


@router.delete(
    "/tickets/{ticket_id}/review",
    status_code=status.HTTP_204_NO_CONTENT
)
def clear_ticket_review(ticket_id: int):
    if not delete_ticket_review(ticket_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This ticket has no review."
        )
