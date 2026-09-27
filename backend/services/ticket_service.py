from database.repositories.ticket_repository import (
    create_ticket,
    get_ticket_by_id,
    get_all_tickets,
    get_open_tickets,
    get_tickets_by_fault,
    update_ticket_status,
    update_ticket_priority,
    update_maintenance_notes,
    get_latest_resolved_ticket_for_fault_identity,
    get_hours_since_resolution,
)

from database.connection import (
    transaction,
)

from database.repositories.ticket_history_repository import (
    create_ticket_history,
)

from database.repositories.fault_repository import (
    get_fault_by_id,
    update_fault_status,
)

from database.repositories.user_repository import (
    get_users_by_role,
)

from services.notification_service import (
    create_system_notification,
)

from services.temporal_processor import (
    clear_window,
)

from config.settings import (
    POST_REPAIR_VERIFICATION_HOURS,
)


ALLOWED_PRIORITIES = {
    "HIGH",
    "MEDIUM",
    "LOW",
}

ALLOWED_STATUSES = {
    "OPEN",
    "RESOLVED",
    "REOPENED",
    "CLOSED",
}


def get_fault_tickets(fault_id):
    get_fault(fault_id)

    return get_tickets_by_fault(fault_id)


def validate_priority(priority):
    if priority not in ALLOWED_PRIORITIES:
        raise ValueError(
            "Invalid priority. Allowed values are "
            "HIGH, MEDIUM, and LOW."
        )


def validate_status(status):
    if status not in ALLOWED_STATUSES:
        raise ValueError(
            "Invalid ticket status. Allowed values are "
            "OPEN, RESOLVED, REOPENED, and CLOSED."
        )


def get_ticket(ticket_id):
    ticket = get_ticket_by_id(ticket_id)

    if ticket is None:
        raise ValueError("Ticket not found.")

    return ticket


def get_tickets():
    return get_all_tickets()


def get_open_ticket_list():
    return get_open_tickets()


def get_fault(fault_id):
    fault = get_fault_by_id(fault_id)

    if fault is None:
        raise ValueError("Fault event not found.")

    return fault


def determine_priority(fault_type):
    if fault_type == "ELECTRICAL_ABNORMALITY":
        return "HIGH"

    if fault_type == "FAN_FAILURE":
        return "MEDIUM"

    if fault_type == "LIGHTS_LEFT_ON":
        return "LOW"

    return "MEDIUM"


def check_post_repair_recurrence(
    room_id,
    fault_type,
    device_id=None
):
    """
    Decide whether a newly confirmed fault is the same fault
    coming back shortly after its ticket was RESOLVED.

    Checked by fault identity (room, fault type, device) before
    any new fault row is created, so a recurrence reopens the
    original fault and ticket instead of leaving a new fault
    without a ticket.
    """

    previous_ticket = (
        get_latest_resolved_ticket_for_fault_identity(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )
    )

    if previous_ticket is None:
        return {
            "is_recurrence": False,
            "classification": "NEW_FAULT",
            "previous_ticket": None,
            "hours_since_resolution": None
        }

    hours_since_resolution = get_hours_since_resolution(
        previous_ticket[0]
    )

    if hours_since_resolution is None:
        return {
            "is_recurrence": False,
            "classification": "NEW_FAULT",
            "previous_ticket": previous_ticket,
            "hours_since_resolution": None
        }

    if (
        0 <= hours_since_resolution
        <= POST_REPAIR_VERIFICATION_HOURS
    ):
        return {
            "is_recurrence": True,
            "classification": "POST_REPAIR_RECURRENCE",
            "previous_ticket": previous_ticket,
            "hours_since_resolution": round(
                hours_since_resolution,
                2
            )
        }

    return {
        "is_recurrence": False,
        "classification": "NEW_FAULT",
        "previous_ticket": previous_ticket,
        "hours_since_resolution": round(
            hours_since_resolution,
            2
        )
    }


def create_ticket_notifications(
    ticket,
    fault
):
    """
    Create notifications for all active supervisors
    when a new maintenance ticket is created.

    This function only creates notifications.
    It does not create or modify tickets.
    """

    supervisors = get_users_by_role(
        "SUPERVISOR"
    )

    ticket_id = ticket[0]
    priority = ticket[2]

    fault_type = fault[3]
    room_id = fault[1]
    device_id = fault[2]

    if fault_type == "FAN_FAILURE":
        fault_name = "Fan failure"

    elif fault_type == "LIGHTS_LEFT_ON":
        fault_name = "Lights left on"

    elif fault_type == "ELECTRICAL_ABNORMALITY":
        fault_name = "Electrical abnormality"

    else:
        fault_name = fault_type

    if device_id is not None:
        message = (
            f"{fault_name} detected in room {room_id} "
            f"for device {device_id}. "
            f"Ticket #{ticket_id} has been created "
            f"with {priority} priority."
        )

    else:
        message = (
            f"{fault_name} detected in room {room_id}. "
            f"Ticket #{ticket_id} has been created "
            f"with {priority} priority."
        )

    for supervisor in supervisors:

        supervisor_id = supervisor[0]
        is_active = supervisor[6]

        if not is_active:
            continue

        create_system_notification(
            user_id=supervisor_id,
            notification_type="TICKET_CREATED",
            message=message,
            ticket_id=ticket_id
        )


def create_recurrence_notification(
    ticket,
    fault
):
    """
    Create notifications for all active supervisors
    when a resolved ticket is reopened because the
    same fault recurred during the verification period.
    """

    supervisors = get_users_by_role(
        "SUPERVISOR"
    )

    ticket_id = ticket[0]

    fault_type = fault[3]
    room_id = fault[1]
    device_id = fault[2]

    if fault_type == "FAN_FAILURE":
        fault_name = "Fan failure"

    elif fault_type == "LIGHTS_LEFT_ON":
        fault_name = "Lights left on"

    elif fault_type == "ELECTRICAL_ABNORMALITY":
        fault_name = "Electrical abnormality"

    else:
        fault_name = fault_type

    if device_id is not None:
        message = (
            f"{fault_name} recurred in room {room_id} "
            f"for device {device_id} during the "
            f"post-repair verification period. "
            f"Ticket #{ticket_id} has been reopened."
        )

    else:
        message = (
            f"{fault_name} recurred in room {room_id} "
            f"during the post-repair verification period. "
            f"Ticket #{ticket_id} has been reopened."
        )

    for supervisor in supervisors:

        supervisor_id = supervisor[0]
        is_active = supervisor[6]

        if not is_active:
            continue

        create_system_notification(
            user_id=supervisor_id,
            notification_type="TICKET_REOPENED",
            message=message,
            ticket_id=ticket_id
        )


def reopen_existing_ticket_for_recurrence(
    ticket,
    fault,
    changed_by=None
):
    """
    Reopen the existing RESOLVED ticket when the same
    fault recurs during the post-repair verification period.

    No new ticket is created.
    """

    ticket_id = ticket[0]
    current_status = ticket[3]

    if current_status != "RESOLVED":
        raise ValueError(
            "Only a resolved ticket can be reopened "
            "for post-repair recurrence."
        )

    with transaction():
        updated_ticket = update_ticket_status(
            ticket_id=ticket_id,
            status="REOPENED"
        )

        create_ticket_history(
            ticket_id=ticket_id,
            previous_status="RESOLVED",
            new_status="REOPENED",
            changed_by=changed_by,
            note=(
                "Ticket reopened because the same fault "
                "recurred during the post-repair verification period."
            )
        )

        update_fault_status(
            fault_id=ticket[1],
            status="REOPENED"
        )

        create_recurrence_notification(
            ticket=updated_ticket,
            fault=fault
        )

    return updated_ticket

def create_fault_ticket(
    fault_id,
    priority=None
):
    fault = get_fault(fault_id)

    fault_status = fault[6]

    if fault_status not in {"OPEN", "REOPENED"}:
        raise ValueError(
            "A ticket can only be created for an active fault."
        )

    fault_type = fault[3]

    existing_tickets = get_tickets_by_fault(
        fault_id
    )

    for ticket in existing_tickets:
        if ticket[3] in {
            "OPEN",
            "REOPENED",
            "RESOLVED"
        }:
            raise ValueError(
                "An active ticket already exists for this fault."
            )

    if priority is None:
        priority = determine_priority(
            fault_type
        )

    validate_priority(priority)

    with transaction():
        ticket = create_ticket(
            fault_id=fault_id,
            priority=priority,
            status="OPEN"
        )

        create_ticket_history(
            ticket_id=ticket[0],
            previous_status=None,
            new_status="OPEN",
            changed_by=None,
            note="Ticket created for confirmed fault."
        )

        create_ticket_notifications(
            ticket=ticket,
            fault=fault
        )

    return ticket


def change_ticket_status(
    ticket_id,
    new_status,
    changed_by=None,
    maintenance_notes=None,
    note=None
):
    ticket = get_ticket(ticket_id)

    validate_status(new_status)

    current_status = ticket[3]

    if current_status == new_status:
        raise ValueError(
            "Ticket is already in this status."
        )

    if current_status == "OPEN":
        allowed_next_statuses = {
            "RESOLVED",
        }

    elif current_status == "RESOLVED":
        allowed_next_statuses = {
            "CLOSED",
            "REOPENED",
        }

    elif current_status == "REOPENED":
        allowed_next_statuses = {
            "RESOLVED",
        }

    elif current_status == "CLOSED":
        allowed_next_statuses = set()

    else:
        allowed_next_statuses = set()

    if new_status not in allowed_next_statuses:
        raise ValueError(
            f"Invalid status transition: "
            f"{current_status} -> {new_status}."
        )

    with transaction():
        updated_ticket = update_ticket_status(
            ticket_id=ticket_id,
            status=new_status,
            maintenance_notes=maintenance_notes
        )

        create_ticket_history(
            ticket_id=ticket_id,
            previous_status=current_status,
            new_status=new_status,
            changed_by=changed_by,
            note=note
        )

        # Ticket and fault statuses share the same names.
        fault = update_fault_status(
            fault_id=updated_ticket[1],
            status=new_status
        )

    if new_status == "RESOLVED" and fault is not None:
        # Readings taken before the repair must not count
        # towards a post-repair recurrence.
        clear_window(
            room_id=fault[1],
            fault_type=fault[3],
            device_id=fault[2]
        )

    return updated_ticket


def resolve_ticket(
    ticket_id,
    changed_by=None,
    maintenance_notes=None
):
    return change_ticket_status(
        ticket_id=ticket_id,
        new_status="RESOLVED",
        changed_by=changed_by,
        maintenance_notes=maintenance_notes,
        note="Maintenance staff marked the ticket as resolved."
    )


def reopen_ticket(
    ticket_id,
    changed_by=None,
    note=None
):
    return change_ticket_status(
        ticket_id=ticket_id,
        new_status="REOPENED",
        changed_by=changed_by,
        note=note or "Fault persists after verification."
    )


def close_ticket(
    ticket_id,
    changed_by=None,
    note=None
):
    return change_ticket_status(
        ticket_id=ticket_id,
        new_status="CLOSED",
        changed_by=changed_by,
        note=note or "Ticket closed after successful verification."
    )


def change_ticket_priority(
    ticket_id,
    priority
):
    ticket = get_ticket(ticket_id)

    if ticket[3] in {"RESOLVED", "CLOSED"}:
        raise ValueError(
            "Ticket priority cannot be changed after the ticket is resolved."
        )

    validate_priority(priority)

    return update_ticket_priority(
        ticket_id=ticket_id,
        priority=priority
    )


def update_ticket_notes(
    ticket_id,
    maintenance_notes
):
    get_ticket(ticket_id)

    return update_maintenance_notes(
        ticket_id=ticket_id,
        maintenance_notes=maintenance_notes
    )