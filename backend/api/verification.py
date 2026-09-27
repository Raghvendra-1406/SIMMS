from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth_dependencies import (
    require_supervisor,
)

from services.verification_service import (
    verify_ticket,
)


router = APIRouter(
    prefix="/verification",
    tags=["Post-Repair Verification"]
)


@router.post("/ticket/{ticket_id}")
def verify_ticket_endpoint(
    ticket_id: int,
    current_user=Depends(require_supervisor)
):
    try:
        result = verify_ticket(
            ticket_id=ticket_id,
            changed_by=current_user["user_id"]
        )

        return result

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )
