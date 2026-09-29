from services.temporal_processor import (
    add_observation,
)

from services.fan_service import (
    evaluate_fan_status,
)

from services.light_service import (
    evaluate_light_status,
)

from services.electrical_service import (
    evaluate_electrical_status,
)

from services.board_service import (
    evaluate_board_status,
)

from services.fault_detector import (
    FAULT_FAN_FAILURE,
    FAULT_LIGHTS_LEFT_ON,
    FAULT_ELECTRICAL_ABNORMALITY,
    FAULT_BOARD_NEEDS_CLEANING,
    get_active_fault,
    create_confirmed_fault,
)

from services.ticket_service import (
    auto_resolve_ticket,
    check_post_repair_recurrence,
    create_fault_ticket,
    get_fault,
    reopen_existing_ticket_for_recurrence,
)

from database.connection import (
    transaction,
)

from config.settings import (
    COOLDOWN_MINUTES,
)

from database.repositories.fault_repository import (
    lock_fault_identity,
    update_fault_recurrence_type,
)

from database.repositories.ticket_repository import (
    get_recently_closed_ticket_for_fault_identity,
    get_tickets_by_fault,
)


ACTIVE_TICKET_EXISTS = "An active ticket already exists for this fault."


def ensure_fault_ticket(fault_id):
    """
    Create a ticket for an active fault unless one already exists.
    """

    try:
        return create_fault_ticket(
            fault_id=fault_id
        )

    except ValueError as exc:
        if str(exc) == ACTIVE_TICKET_EXISTS:
            return None

        raise


def handle_confirmed_fault(
    fault_type,
    room_id,
    device_id,
    abnormal_count
):
    """
    Turn a temporally confirmed fault into a fault event and ticket.

    Runs as one transaction under a per-identity advisory lock:

    - Active fault already exists: keep it, make sure it has a ticket.
    - Same fault recurred within POST_REPAIR_VERIFICATION_HOURS of
      its ticket being RESOLVED: reopen that fault and ticket.
    - A ticket for the same fault was closed less than
      COOLDOWN_MINUTES ago: suppress it (Plan v2 §7.3), so a room a
      technician just fixed does not immediately raise a new ticket.
    - Otherwise: create a new fault event and a new ticket.

    The fault, ticket, history and notification rows are committed
    together, or not at all.
    """

    with transaction():

        lock_fault_identity(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        active_fault = get_active_fault(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        if active_fault is not None:
            return {
                "action": "ALREADY_ACTIVE",
                "fault": active_fault,
                "ticket": ensure_fault_ticket(active_fault[0]),
                "recurrence": None
            }

        recurrence = check_post_repair_recurrence(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        if recurrence["is_recurrence"]:

            previous_ticket = recurrence["previous_ticket"]

            ticket = reopen_existing_ticket_for_recurrence(
                ticket=previous_ticket,
                fault=get_fault(previous_ticket[1])
            )

            fault = update_fault_recurrence_type(
                fault_id=ticket[1],
                recurrence_type=recurrence["classification"]
            )

            return {
                "action": "REOPENED",
                "fault": fault,
                "ticket": ticket,
                "recurrence": recurrence
            }

        recently_closed = get_recently_closed_ticket_for_fault_identity(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id,
            within_minutes=COOLDOWN_MINUTES
        )

        if recently_closed is not None:
            return {
                "action": "COOLDOWN",
                "fault": None,
                "ticket": recently_closed,
                "recurrence": recurrence
            }

        fault = create_confirmed_fault(
            room_id=room_id,
            device_id=device_id,
            fault_type=fault_type,
            confidence=100.0,
            abnormal_count=abnormal_count,
            recurrence_type=recurrence["classification"]
        )

        return {
            "action": "CREATED",
            "fault": fault,
            "ticket": ensure_fault_ticket(fault[0]),
            "recurrence": recurrence
        }


def handle_recovered_fault(
    fault_type,
    room_id,
    device_id
):
    """
    The condition has cleared (3 of the last 5 observations normal).

    If the fault still has an untouched OPEN ticket, nobody has acted
    yet, so the ticket is closed as AUTO_RESOLVED (Plan v2 §7.3).
    Tickets that staff already handled (RESOLVED, REOPENED) are left
    to the normal verification flow.
    """

    with transaction():

        lock_fault_identity(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        active_fault = get_active_fault(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        if active_fault is None:
            return None

        open_ticket = next(
            (
                ticket
                for ticket in get_tickets_by_fault(active_fault[0])
                if ticket[3] == "OPEN"
            ),
            None
        )

        if open_ticket is None:
            return None

        return {
            "action": "AUTO_RESOLVED",
            "fault": active_fault,
            "ticket": auto_resolve_ticket(
                ticket=open_ticket,
                fault=active_fault
            ),
            "recurrence": None
        }


def apply_observation(
    fault_type,
    room_id,
    device_id,
    status,
    is_abnormal
):
    """
    Shared flow for every detector after its condition is evaluated:

    1. Add the observation to the 5-observation temporal window.
    2. When 4 of 5 are abnormal, hand the fault to
       handle_confirmed_fault() (create / reopen / cooldown).
    3. When the condition clears (3 of 5 normal), let
       handle_recovered_fault() auto-resolve an untouched ticket.
    """

    temporal_result = add_observation(
        room_id=room_id,
        fault_type=fault_type,
        device_id=device_id,
        is_abnormal=is_abnormal
    )

    handled = None

    if temporal_result["needs_handling"]:
        handled = handle_confirmed_fault(
            fault_type=fault_type,
            room_id=room_id,
            device_id=device_id,
            abnormal_count=temporal_result["abnormal_count"]
        )

    elif temporal_result["newly_recovered"]:
        handled = handle_recovered_fault(
            fault_type=fault_type,
            room_id=room_id,
            device_id=device_id
        )

    handled = handled or {}

    return {
        "processed": True,
        "status": status,
        "is_abnormal": is_abnormal,
        "temporal": temporal_result,
        "action": handled.get("action"),
        "fault": handled.get("fault"),
        "ticket": handled.get("ticket"),
        "recurrence": handled.get("recurrence")
    }


def not_processed():
    """
    Unknown condition (missing / stale / low-confidence data):
    the observation is stored but does not vote.
    """

    return {
        "processed": False,
        "status": "UNKNOWN",
        "temporal": None,
        "action": None,
        "fault": None,
        "ticket": None,
        "recurrence": None
    }


def process_fan_observation(
    room_id,
    device_id
):
    """
    Fan failure: current flowing but the fan is not rotating.
    """

    status = evaluate_fan_status(
        room_id=room_id,
        device_id=device_id
    )["status"]

    if status == "FAILURE_CANDIDATE":
        is_abnormal = True

    elif status in {"WORKING", "OFF", "ABNORMAL"}:
        is_abnormal = False

    else:
        return not_processed()

    return apply_observation(
        fault_type=FAULT_FAN_FAILURE,
        room_id=room_id,
        device_id=device_id,
        status=status,
        is_abnormal=is_abnormal
    )


def process_light_observation(
    room_id
):
    """
    Lights left on: light ON while the room has been vacant for
    VACANCY_MINUTES.
    """

    status = evaluate_light_status(
        room_id=room_id
    )["status"]

    if status == "WASTAGE_CANDIDATE":
        is_abnormal = True

    elif status == "NORMAL":
        is_abnormal = False

    else:
        return not_processed()

    return apply_observation(
        fault_type=FAULT_LIGHTS_LEFT_ON,
        room_id=room_id,
        device_id=None,
        status=status,
        is_abnormal=is_abnormal
    )


def process_electrical_observation(
    room_id
):
    """
    Electrical abnormality: voltage, current, power or power factor
    outside the allowed range.
    """

    status = evaluate_electrical_status(
        room_id=room_id
    )["status"]

    if status == "ABNORMALITY_CANDIDATE":
        is_abnormal = True

    elif status == "NORMAL":
        is_abnormal = False

    else:
        return not_processed()

    return apply_observation(
        fault_type=FAULT_ELECTRICAL_ABNORMALITY,
        room_id=room_id,
        device_id=None,
        status=status,
        is_abnormal=is_abnormal
    )


def process_board_observation(
    room_id
):
    """
    Board needs cleaning: board DIRTY while the room has been vacant
    for VACANCY_MINUTES. Occluded, stale or low-confidence readings
    do not vote.
    """

    status = evaluate_board_status(
        room_id=room_id
    )["status"]

    if status == "CLEANING_CANDIDATE":
        is_abnormal = True

    elif status == "NORMAL":
        is_abnormal = False

    else:
        return not_processed()

    return apply_observation(
        fault_type=FAULT_BOARD_NEEDS_CLEANING,
        room_id=room_id,
        device_id=None,
        status=status,
        is_abnormal=is_abnormal
    )
