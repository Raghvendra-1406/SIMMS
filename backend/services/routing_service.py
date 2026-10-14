"""
Ticket routing, assignment and response SLA (Plan v2 §9, C7).

- Every fault type belongs to a category; every category is handled
  by a staff team. A new ticket goes to the active staff member of
  that team with the fewest active tickets (GENERAL staff, then any
  staff, as fallbacks). With no staff at all it stays unassigned.
- The response SLA depends on priority (config SLA_HOURS). Staff
  "start work" (or resolving the ticket) is the response.
- A ticket still not started after its SLA is escalated once:
  HIGH / MEDIUM notify supervisors and the assignee, LOW is only
  flagged as overdue (§9.2 "digest notification only").
- Reopening a ticket restarts the SLA clock; a priority change moves
  the due time.

The mappings below are the current design decision and are meant to
be changed as the team decides.
"""

from datetime import datetime, timedelta, timezone

from config.settings import SLA_HOURS

from database.repositories.ticket_routing_repository import (
    get_breached_tickets,
    get_maintenance_staff,
    get_ticket_routing,
    mark_ticket_escalated,
    mark_ticket_started,
    restart_ticket_sla,
    set_ticket_assignee,
    set_ticket_routing,
    set_ticket_sla_due,
)

from database.repositories.user_repository import get_user_by_id

from database.repositories.fault_repository import get_fault_by_id

from services.notification_service import create_system_notification


CATEGORY_BY_FAULT = {
    "FAN_FAILURE": "ELECTRICAL",
    "LIGHT_FAILURE": "ELECTRICAL",
    "ELECTRICAL_ABNORMALITY": "ELECTRICAL",
    "BOARD_NEEDS_CLEANING": "CLEANING",
    "ENERGY_WASTAGE": "ENERGY",
    "LIGHTS_LEFT_ON": "ENERGY",
}

DEFAULT_CATEGORY = "ELECTRICAL"

TEAMS = ("ELECTRICAL", "HOUSEKEEPING", "GENERAL")

# Plan §9.1 routes energy wastage to the electrical supervisor; here
# the electrical team switches the loads off.
TEAM_BY_CATEGORY = {
    "ELECTRICAL": "ELECTRICAL",
    "CLEANING": "HOUSEKEEPING",
    "ENERGY": "ELECTRICAL",
}

FALLBACK_TEAM = "GENERAL"

# Breaches of these priorities notify people; LOW is only flagged.
ESCALATING_PRIORITIES = {"HIGH", "MEDIUM"}

ACTIVE_STATUSES = {"OPEN", "REOPENED", "RESOLVED"}


def category_for(fault_type):
    return CATEGORY_BY_FAULT.get(fault_type, DEFAULT_CATEGORY)


def team_for(category):
    return TEAM_BY_CATEGORY.get(category, FALLBACK_TEAM)


def validate_team(team):
    if team is not None and team not in TEAMS:
        raise ValueError(
            "Invalid team. Allowed values are "
            + ", ".join(TEAMS) + "."
        )


def sla_due_from(start, priority):
    hours = SLA_HOURS.get(priority, SLA_HOURS["MEDIUM"])

    return start + timedelta(hours=hours)


def choose_assignee(category):
    """
    Least-loaded active staff member of the category's team, then of
    the GENERAL team, then anyone. None when there is no staff.
    """

    staff = get_maintenance_staff()

    if not staff:
        return None

    team = team_for(category)

    for pool in (
        [s for s in staff if s["team"] == team],
        [s for s in staff if s["team"] in (None, FALLBACK_TEAM)],
        staff,
    ):
        if pool:
            return min(
                pool,
                key=lambda s: (s["active_tickets"], s["user_id"])
            )

    return None


def sla_state(routing, status, now=None):
    """
    ON_TRACK / DUE_SOON (last quarter of the window) / OVERDUE /
    MET (started in time) / LATE (started after the deadline) /
    None (closed or no SLA).
    """

    due = routing.get("sla_due_at")

    if due is None:
        return None

    started = routing.get("started_at")

    if started is not None:
        return "MET" if started <= due else "LATE"

    if status not in {"OPEN", "REOPENED"}:
        return None

    now = now or datetime.now(timezone.utc)

    if now >= due:
        return "OVERDUE"

    begun = routing.get("sla_started_at") or due

    if (due - now) <= (due - begun) / 4:
        return "DUE_SOON"

    return "ON_TRACK"


def routing_fields(ticket, routing):
    """
    Fields added to every ticket response.
    """

    routing = routing or {}

    return {
        "category": routing.get("category"),
        "assigned_to": routing.get("assigned_to"),
        "assigned_to_name": routing.get("assigned_to_name"),
        "assigned_to_team": routing.get("assigned_to_team"),
        "assigned_at": routing.get("assigned_at"),
        "sla_due_at": routing.get("sla_due_at"),
        "started_at": routing.get("started_at"),
        "escalated_at": routing.get("escalated_at"),
        "sla_state": sla_state(routing, ticket[3]),
    }


def notify_assignee(user_id, ticket_id, message, notification_type):
    if user_id is None:
        return

    user = get_user_by_id(user_id)

    if user is None or not user[6]:
        return

    create_system_notification(
        user_id=user_id,
        notification_type=notification_type,
        message=message,
        ticket_id=ticket_id
    )


# ---------------------------------------------------------
# Lifecycle hooks, called by ticket_service inside its transactions
# ---------------------------------------------------------

def route_new_ticket(ticket, fault, summary):
    """
    Category, assignee and SLA for a freshly created ticket.
    Returns the assignee user_id (or None).
    """

    category = category_for(fault[3])
    assignee = choose_assignee(category)

    set_ticket_routing(
        ticket_id=ticket[0],
        category=category,
        assigned_to=assignee["user_id"] if assignee else None,
        sla_due_at=sla_due_from(datetime.now(timezone.utc), ticket[2])
    )

    if assignee:
        notify_assignee(
            assignee["user_id"],
            ticket[0],
            (
                f"{summary}. Ticket #{ticket[0]} ({ticket[2]} priority) "
                f"was assigned to you; respond within "
                f"{format_hours(SLA_HOURS.get(ticket[2], 8))}."
            ),
            "TICKET_ASSIGNED"
        )

    return assignee["user_id"] if assignee else None


def on_ticket_reopened(ticket, summary):
    """
    A reopened ticket needs a fresh response from staff.
    """

    restart_ticket_sla(
        ticket[0],
        sla_due_from(datetime.now(timezone.utc), ticket[2])
    )

    routing = get_ticket_routing([ticket[0]]).get(ticket[0]) or {}

    notify_assignee(
        routing.get("assigned_to"),
        ticket[0],
        f"{summary}. Ticket #{ticket[0]} was reopened and needs another look.",
        "TICKET_REOPENED"
    )


def on_priority_changed(ticket):
    """
    Move the due time of a ticket nobody has started yet.
    """

    routing = get_ticket_routing([ticket[0]]).get(ticket[0])

    if not routing or routing["started_at"] or not routing["sla_started_at"]:
        return

    set_ticket_sla_due(
        ticket[0],
        sla_due_from(routing["sla_started_at"], ticket[2])
    )


def has_started(ticket_id):
    routing = get_ticket_routing([ticket_id]).get(ticket_id)

    return bool(routing and routing["started_at"])


# ---------------------------------------------------------
# User actions
# ---------------------------------------------------------

def assign_ticket(ticket, user_id, assigned_by):
    """
    Assign (or with user_id None, unassign) an active ticket.
    """

    if ticket[3] not in ACTIVE_STATUSES:
        raise ValueError("Only an active ticket can be assigned.")

    if user_id is not None:
        user = get_user_by_id(user_id)

        if user is None or not user[6]:
            raise ValueError("User not found or inactive.")

        if user[4] != "MAINTENANCE_STAFF":
            raise ValueError(
                "Tickets can only be assigned to maintenance staff."
            )

    set_ticket_assignee(ticket[0], user_id)

    if user_id is not None and user_id != assigned_by:
        notify_assignee(
            user_id,
            ticket[0],
            f"Ticket #{ticket[0]} ({ticket[2]} priority) was assigned to you.",
            "TICKET_ASSIGNED"
        )

    return get_ticket_routing([ticket[0]]).get(ticket[0])


def can_staff_act(ticket_id, user_id):
    """
    Staff may act on tickets assigned to them or not assigned at all.
    """

    routing = get_ticket_routing([ticket_id]).get(ticket_id) or {}

    return routing.get("assigned_to") in (None, user_id)


def start_ticket(ticket, user):
    """
    Staff acknowledge a ticket and start work: this is the SLA
    response. An unassigned ticket is claimed by whoever starts it.
    """

    if ticket[3] not in {"OPEN", "REOPENED"}:
        raise ValueError("Work can only start on an open or reopened ticket.")

    routing = get_ticket_routing([ticket[0]]).get(ticket[0]) or {}

    if routing.get("started_at"):
        raise ValueError("Work on this ticket has already started.")

    if routing.get("assigned_to") is None:
        set_ticket_assignee(ticket[0], user["user_id"])

    elif routing["assigned_to"] != user["user_id"]:
        raise PermissionError("This ticket is assigned to someone else.")

    mark_ticket_started(ticket[0])

    return get_ticket_routing([ticket[0]]).get(ticket[0])


def record_response(ticket_id):
    """
    Resolving counts as the response if work was never "started".
    """

    mark_ticket_started(ticket_id)


# ---------------------------------------------------------
# Scheduler job
# ---------------------------------------------------------

def format_hours(hours):
    if hours < 1:
        return f"{round(hours * 60)} min"

    return f"{hours:g} h"


def check_sla_breaches():
    """
    Escalate each breached ticket once. Returns the ticket ids.
    """

    # Imported here: ticket_service imports this module.
    from services.ticket_service import describe_fault, notify_supervisors

    escalated = []

    for ticket in get_breached_tickets():
        if not mark_ticket_escalated(ticket["ticket_id"]):
            continue

        escalated.append(ticket["ticket_id"])

        if ticket["priority"] not in ESCALATING_PRIORITIES:
            continue

        fault = get_fault_by_id(ticket["fault_id"])
        summary = describe_fault(fault) if fault else "A fault"

        assignee = None

        if ticket["assigned_to"] is not None:
            user = get_user_by_id(ticket["assigned_to"])
            assignee = user[1] if user else None

        message = (
            f"SLA missed: {summary}. Ticket #{ticket['ticket_id']} "
            f"({ticket['priority']}) was not started within "
            f"{format_hours(SLA_HOURS.get(ticket['priority'], 8))}"
            + (f"; assigned to {assignee}." if assignee else "; it is unassigned.")
        )

        notify_supervisors("SLA_BREACHED", message, ticket["ticket_id"])

        notify_assignee(
            ticket["assigned_to"],
            ticket["ticket_id"],
            message,
            "SLA_BREACHED"
        )

    return escalated
