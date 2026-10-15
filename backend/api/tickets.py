from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth_dependencies import (
    get_current_user,
    require_admin,
    require_admin_or_supervisor,
)

from schemas.ticket_schema import (
    TicketAssign,
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

from services.routing_service import (
    assign_ticket,
    can_staff_act,
    routing_fields,
    start_ticket,
)

from database.repositories.ticket_routing_repository import (
    get_maintenance_staff,
    get_ticket_routing,
)

router = APIRouter(
    prefix="/tickets",
    tags=["Tickets"]
)


def ticket_to_response(ticket, routing=None):
    if routing is None:
        routing = get_ticket_routing([ticket[0]]).get(ticket[0])

    return {
        "ticket_id": ticket[0],
        "fault_id": ticket[1],
        "priority": ticket[2],
        "status": ticket[3],
        "created_at": ticket[4],
        "resolved_at": ticket[5],
        "closed_at": ticket[6],
        "maintenance_notes": ticket[7],
        **routing_fields(ticket, routing),
    }


def tickets_to_response(tickets):
    """
    One routing query for the whole list.
    """

    routing = get_ticket_routing(ticket[0] for ticket in tickets)

    return [
        ticket_to_response(ticket, routing.get(ticket[0], {}))
        for ticket in tickets
    ]


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
    return tickets_to_response(get_tickets())


# ---------------------------------------------------------
# GET OPEN / REOPENED TICKETS
# ALL AUTHENTICATED USERS
# ---------------------------------------------------------

@router.get(
    "/open",
    response_model=list[TicketResponse]
)
def get_open_tickets_endpoint(
    mine: bool = False,
    current_user=Depends(get_current_user)
):
    """
    Active tickets. ?mine=true: only those assigned to the caller
    plus unassigned ones (the maintenance staff work list).
    """

    tickets = tickets_to_response(get_open_ticket_list())

    if mine:
        tickets = [
            ticket for ticket in tickets
            if ticket["assigned_to"] in (None, current_user["user_id"])
        ]

    return tickets


# ---------------------------------------------------------
# MAINTENANCE STAFF WITH TEAM AND WORKLOAD
# ADMIN + SUPERVISOR (assignment picker)
# ---------------------------------------------------------

@router.get("/staff")
def get_staff_endpoint(
    current_user=Depends(require_admin_or_supervisor)
):
    return get_maintenance_staff()


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
        return tickets_to_response(get_fault_tickets(fault_id))

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

    # Maintenance staff can only mark a ticket as RESOLVED,
    # and only one assigned to them (or unassigned).
    if user_role == "MAINTENANCE_STAFF":
        if requested_status != "RESOLVED":
            raise HTTPException(
                status_code=403,
                detail="Maintenance Staff can only resolve tickets."
            )

        if not can_staff_act(ticket_id, current_user["user_id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This ticket is assigned to someone else."
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


# ---------------------------------------------------------
# ASSIGN / REASSIGN / UNASSIGN
# ADMIN + SUPERVISOR
# ---------------------------------------------------------

@router.put(
    "/{ticket_id}/assignee",
    response_model=TicketResponse
)
def assign_ticket_endpoint(
    ticket_id: int,
    assignment: TicketAssign,
    current_user=Depends(require_admin_or_supervisor)
):
    try:
        ticket = get_ticket(ticket_id)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )

    try:
        routing = assign_ticket(
            ticket=ticket,
            user_id=assignment.user_id,
            assigned_by=current_user["user_id"]
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )

    return ticket_to_response(ticket, routing)


# ---------------------------------------------------------
# START WORK (the SLA response)
# MAINTENANCE STAFF
# ---------------------------------------------------------

@router.post(
    "/{ticket_id}/start",
    response_model=TicketResponse
)
def start_ticket_endpoint(
    ticket_id: int,
    current_user=Depends(get_current_user)
):
    if current_user["role"] != "MAINTENANCE_STAFF":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only maintenance staff start work on tickets."
        )

    try:
        ticket = get_ticket(ticket_id)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )

    try:
        routing = start_ticket(ticket, current_user)

    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc)
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )

    return ticket_to_response(ticket, routing)
