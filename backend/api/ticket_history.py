from fastapi import APIRouter, Depends, HTTPException

from dependencies.auth_dependencies import (
    get_current_user,
)

from schemas.ticket_history_schema import (
    TicketHistoryResponse,
)

from services.ticket_history_service import (
    get_history,
    get_latest_history,
    get_history_by_id,
)


router = APIRouter(
    prefix="/ticket-history",
    tags=["Ticket History"],
    dependencies=[Depends(get_current_user)]
)


def history_to_response(history):
    return {
        "history_id": history[0],
        "ticket_id": history[1],
        "previous_status": history[2],
        "new_status": history[3],
        "changed_at": history[4],
        "changed_by": history[5],
        "note": history[6],
    }


@router.get(
    "/ticket/{ticket_id}",
    response_model=list[TicketHistoryResponse]
)
def get_ticket_history_endpoint(ticket_id: int):
    try:
        history = get_history(ticket_id)

        return [
            history_to_response(item)
            for item in history
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        )


@router.get(
    "/ticket/{ticket_id}/latest",
    response_model=TicketHistoryResponse
)
def get_latest_ticket_history_endpoint(ticket_id: int):
    try:
        history = get_latest_history(ticket_id)

        if history is None:
            raise HTTPException(
                status_code=404,
                detail="Ticket history not found."
            )

        return history_to_response(history)

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        )


@router.get(
    "/{history_id}",
    response_model=TicketHistoryResponse
)
def get_ticket_history_by_id_endpoint(history_id: int):
    try:
        history = get_history_by_id(history_id)

        return history_to_response(history)

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        )