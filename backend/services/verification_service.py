from database.repositories.fault_repository import (
    get_fault_by_id,
)

from database.repositories.ticket_repository import (
    get_ticket_by_id,
)

from database.repositories.ticket_evidence_repository import (
    create_ticket_evidence,
)

from services.fault_conditions import (
    current_condition,
)

from services.ticket_service import (
    close_ticket,
    reopen_ticket,
)

from services.temporal_processor import (
    WINDOW_SIZE,
    add_observation,
    is_recovered,
    get_recent_window,
    clear_window,
)


# Post-repair verification (Plan v2 §9.3): after maintenance marks a
# ticket RESOLVED, the supervisor verifies it against live readings.
# Each verification adds one observation to a separate window; after
# WINDOW_SIZE observations the ticket is CLOSED when at least 3 were
# normal, otherwise REOPENED.


def get_ticket(ticket_id):
    ticket = get_ticket_by_id(ticket_id)

    if ticket is None:
        raise ValueError("Ticket not found.")

    return ticket


def get_fault_for_ticket(ticket_id):
    ticket = get_ticket(ticket_id)

    fault = get_fault_by_id(ticket[1])

    if fault is None:
        raise ValueError("Fault event not found.")

    return fault


def verification_window_key(fault_type):
    # Separate from the detection window, so verification readings
    # never mix with fault detection.
    return f"{fault_type}_VERIFICATION"


def verify_ticket(
    ticket_id,
    changed_by=None
):
    ticket = get_ticket(ticket_id)

    if ticket[3] != "RESOLVED":
        raise ValueError(
            "Only RESOLVED tickets can be verified."
        )

    fault = get_fault_for_ticket(ticket_id)

    room_id = fault[1]
    device_id = fault[2]
    fault_type = fault[3]

    abnormal, evidence = current_condition(
        fault_type=fault_type,
        room_id=room_id,
        device_id=device_id,
        purpose="verify"
    )

    if abnormal is None:
        return {
            "verified": False,
            "status": "INSUFFICIENT_DATA",
            "ticket": ticket,
            "evidence": evidence,
            "message": (
                "The current readings cannot confirm the repair. "
                "Make sure the unit is switched on and visible to "
                "the camera, then verify again."
            ),
        }

    window_key = verification_window_key(fault_type)

    temporal_result = add_observation(
        room_id=room_id,
        fault_type=window_key,
        device_id=device_id,
        is_abnormal=abnormal
    )

    create_ticket_evidence(
        ticket_id=ticket_id,
        evidence_type=fault_type,
        evidence_data={
            **evidence,
            "fault_present": abnormal,
            "temporal": {
                "window": temporal_result["window"],
                "window_size": temporal_result["window_size"],
            },
        },
        evidence_stage="VERIFICATION"
    )

    if temporal_result["window_size"] < WINDOW_SIZE:
        return {
            "verified": False,
            "status": "VERIFICATION_IN_PROGRESS",
            "ticket": ticket,
            "evidence": evidence,
            "temporal": temporal_result,
        }

    recovered = is_recovered(
        room_id=room_id,
        fault_type=window_key,
        device_id=device_id
    )

    recent_window = get_recent_window(
        room_id=room_id,
        fault_type=window_key,
        device_id=device_id
    )

    clear_window(
        room_id=room_id,
        fault_type=window_key,
        device_id=device_id
    )

    if recovered:
        ticket = close_ticket(
            ticket_id=ticket_id,
            changed_by=changed_by,
            note=(
                "Post-repair verification passed. "
                "At least 3 of the last 5 observations "
                "were normal."
            )
        )

    else:
        ticket = reopen_ticket(
            ticket_id=ticket_id,
            changed_by=changed_by,
            note=(
                "Post-repair verification failed. "
                "Fault persists in the verification window."
            )
        )

    return {
        "verified": recovered,
        "status": "CLOSED" if recovered else "REOPENED",
        "ticket": ticket,
        "evidence": evidence,
        "temporal": {
            "window": recent_window,
            "window_size": len(recent_window),
            "recovered": recovered,
        },
    }
