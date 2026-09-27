from database.repositories.ticket_evidence_repository import (
    get_evidence_by_id,
    get_ticket_evidence,
    get_detection_evidence,
    get_verification_evidence,
)

from database.repositories.ticket_repository import (
    get_ticket_by_id,
)


def validate_ticket_exists(ticket_id):
    ticket = get_ticket_by_id(ticket_id)

    if ticket is None:
        raise ValueError("Ticket not found.")

    return ticket


def get_evidence(evidence_id):
    evidence = get_evidence_by_id(evidence_id)

    if evidence is None:
        raise ValueError("Ticket evidence not found.")

    return evidence


def get_all_ticket_evidence(ticket_id):
    validate_ticket_exists(ticket_id)

    return get_ticket_evidence(ticket_id)


def get_ticket_detection_evidence(ticket_id):
    validate_ticket_exists(ticket_id)

    return get_detection_evidence(ticket_id)


def get_ticket_verification_evidence(ticket_id):
    validate_ticket_exists(ticket_id)

    return get_verification_evidence(ticket_id)