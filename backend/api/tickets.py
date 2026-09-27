from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth_dependencies import (
    get_current_user,
    require_admin,
    require_admin_or_supervisor,
)

from schemas.ticket_schema import (
    TicketCreate,
    TicketMaintenanceNotesUpdate,
    TicketPriorityUpdate,
    TicketResponse,
    TicketStatusUpdate,
)

from services.ticket_service import (
    create_fault_ticket,
    get_ticket,
    get_tickets,
    get_open_ticket_list,
    get_fault_tickets,
    change_ticket_status,
    change_ticket_priority,
    update_ticket_notes,
)

router = APIRouter(
    prefix="/tickets",
    tags=["Tickets"]
)


def ticket_to_response(ticket):
    return {
        "ticket_id": ticket[0],
        "fault_id": ticket[1],
        "priority": ticket[2],
        "status": ticket[3],
        "created_at": ticket[4],
        "resolved_at": ticket[5],
        "closed_at": ticket[6],
        "maintenance_notes": ticket[7]
    }


# ---------------------------------------------------------
# CREATE TICKET
# ADMIN ONLY
# ---------------------------------------------------------

@router.post(
    "",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED
)
def create_ticket_endpoint(
    ticket: TicketCreate,
    current_user=Depends(require_admin)
):
    try:
        created_ticket = create_fault_ticket(
            fault_id=ticket.fault_id,
            priority=(
                ticket.priority
                if ticket.priority != "MEDIUM"
                else None
            )
        )

        return ticket_to_response(created_ticket)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


# ---------------------------------------------------------
# GET ALL TICKETS
# ADMIN + SUPERVISOR
# ---------------------------------------------------------

@router.get(
    "",
    response_model=list[TicketResponse]
)
def get_all_tickets_endpoint(
    current_user=Depends(require_admin_or_supervisor)
):
    tickets = get_tickets()

    return [
        ticket_to_response(ticket)
        for ticket in tickets
    ]


# ---------------------------------------------------------
# GET OPEN / REOPENED TICKETS
# ALL AUTHENTICATED USERS
# ---------------------------------------------------------

@router.get(
    "/open",
    response_model=list[TicketResponse]
)
def get_open_tickets_endpoint(
    current_user=Depends(get_current_user)
):
    tickets = get_open_ticket_list()

    return [
        ticket_to_response(ticket)
        for ticket in tickets
    ]


# ---------------------------------------------------------
# GET TICKETS FOR A FAULT
# ADMIN + SUPERVISOR
# ---------------------------------------------------------

@router.get(
    "/fault/{fault_id}",
    response_model=list[TicketResponse]
)
def get_tickets_for_fault(
    fault_id: int,
    current_user=Depends(require_admin_or_supervisor)
):
    try:
        tickets = get_fault_tickets(fault_id)

        return [
            ticket_to_response(ticket)
            for ticket in tickets
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


# ---------------------------------------------------------
# GET INDIVIDUAL TICKET
# ALL AUTHENTICATED USERS
# ---------------------------------------------------------

@router.get(
    "/{ticket_id}",
    response_model=TicketResponse
)
def get_ticket_endpoint(
    ticket_id: int,
    current_user=Depends(get_current_user)
):
    try:
        ticket = get_ticket(ticket_id)

        return ticket_to_response(ticket)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


# ---------------------------------------------------------
# UPDATE TICKET STATUS
#
# ADMIN:
#   Administrative control over status transitions
#
# SUPERVISOR:
#   Can change ticket status operationally
#
# MAINTENANCE_STAFF:
#   Can mark ticket RESOLVED or CLOSED
# ---------------------------------------------------------

@router.patch(
    "/{ticket_id}/status",
    response_model=TicketResponse
)
def update_ticket_status_endpoint(
    ticket_id: int,
    ticket_status: TicketStatusUpdate,
    current_user=Depends(get_current_user)
):
    requested_status = ticket_status.status
    user_role = current_user["role"]

    # Maintenance staff can only mark a ticket as RESOLVED.
    if user_role == "MAINTENANCE_STAFF":
        if requested_status != "RESOLVED":
            raise HTTPException(
                status_code=403,
                detail="Maintenance Staff can only resolve tickets."
            )

    # Only the three defined roles should reach this endpoint.
    elif user_role not in {
        "ADMIN",
        "SUPERVISOR",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to change ticket status."
        )

    try:
        updated_ticket = change_ticket_status(
            ticket_id=ticket_id,
            new_status=requested_status,
            changed_by=current_user["user_id"],
            maintenance_notes=ticket_status.maintenance_notes
        )

        return ticket_to_response(updated_ticket)

    except ValueError as exc:
        if str(exc) == "Ticket not found.":
            error_status = status.HTTP_404_NOT_FOUND
        else:
            error_status = status.HTTP_400_BAD_REQUEST

        raise HTTPException(
            status_code=error_status,
            detail=str(exc)
        )


# ---------------------------------------------------------
# UPDATE TICKET PRIORITY
# ADMIN + SUPERVISOR
# ---------------------------------------------------------

@router.patch(
    "/{ticket_id}/priority",
    response_model=TicketResponse
)
def update_ticket_priority_endpoint(
    ticket_id: int,
    ticket_priority: TicketPriorityUpdate,
    current_user=Depends(require_admin_or_supervisor)
):
    try:
        updated_ticket = change_ticket_priority(
            ticket_id=ticket_id,
            priority=ticket_priority.priority
        )

        return ticket_to_response(updated_ticket)

    except ValueError as exc:
        if str(exc) == "Ticket not found.":
            error_status = status.HTTP_404_NOT_FOUND
        else:
            error_status = status.HTTP_400_BAD_REQUEST

        raise HTTPException(
            status_code=error_status,
            detail=str(exc)
        )


# ---------------------------------------------------------
# UPDATE MAINTENANCE NOTES
# ADMIN + MAINTENANCE STAFF
# ---------------------------------------------------------

@router.patch(
    "/{ticket_id}/notes",
    response_model=TicketResponse
)
def update_ticket_notes_endpoint(
    ticket_id: int,
    ticket_notes: TicketMaintenanceNotesUpdate,
    current_user=Depends(get_current_user)
):
    if current_user["role"] not in {
        "ADMIN",
        "MAINTENANCE_STAFF",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only Admin or Maintenance Staff can "
                "update maintenance notes."
            )
        )

    try:
        updated_ticket = update_ticket_notes(
            ticket_id=ticket_id,
            maintenance_notes=ticket_notes.maintenance_notes
        )

        return ticket_to_response(updated_ticket)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )
