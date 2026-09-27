from database.repositories.ticket_history_repository import (
    create_ticket_history,
    get_ticket_history,
    get_latest_ticket_history,
    get_ticket_history_by_id,
)

from database.repositories.ticket_repository import (
    get_ticket_by_id,
)


def validate_ticket_exists(ticket_id):
    ticket = get_ticket_by_id(ticket_id)

    if ticket is None:
        raise ValueError("Ticket not found.")

    return ticket


def create_history(
    ticket_id,
    previous_status,
    new_status,
    changed_by=None,
    note=None
):
    validate_ticket_exists(ticket_id)

    if not new_status:
        raise ValueError("New status is required.")

    return create_ticket_history(
        ticket_id=ticket_id,
        previous_status=previous_status,
        new_status=new_status,
        changed_by=changed_by,
        note=note
    )


def get_history(ticket_id):
    validate_ticket_exists(ticket_id)

    return get_ticket_history(ticket_id)


def get_latest_history(ticket_id):
    validate_ticket_exists(ticket_id)

    return get_latest_ticket_history(ticket_id)


def get_history_by_id(history_id):
    history = get_ticket_history_by_id(history_id)

    if history is None:
        raise ValueError("Ticket history not found.")

    return history