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

from services.fault_detector import (
    FAULT_FAN_FAILURE,
    FAULT_LIGHTS_LEFT_ON,
    FAULT_ELECTRICAL_ABNORMALITY,
    get_active_fault,
    create_confirmed_fault,
)

from services.ticket_service import (
    check_post_repair_recurrence,
    create_fault_ticket,
    get_fault,
    reopen_existing_ticket_for_recurrence,
)

from database.connection import (
    transaction,
)

from database.repositories.fault_repository import (
    lock_fault_identity,
    update_fault_recurrence_type,
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


def process_fan_observation(
    room_id,
    device_id
):
    """
    Process a new fan-related observation.

    Flow:
    1. Evaluate the current fan condition.
    2. Convert it into an abnormal/normal observation.
    3. Add it to the 5-observation temporal window.
    4. Confirm the fault when 4 out of 5 observations are abnormal.
    5. Hand the confirmed fault to handle_confirmed_fault(), which
       creates the fault and ticket, or reopens the original ticket
       when the fault recurs soon after a repair.
    """

    result = evaluate_fan_status(
        room_id=room_id,
        device_id=device_id
    )

    status = result["status"]

    if status == "FAILURE_CANDIDATE":
        is_abnormal = True

    elif status in {
        "WORKING",
        "OFF",
        "ABNORMAL",
    }:
        is_abnormal = False

    else:
        return {
            "processed": False,
            "status": "UNKNOWN",
            "temporal": None,
            "fault": None,
            "ticket": None,
            "recurrence": None
        }

    temporal_result = add_observation(
        room_id=room_id,
        fault_type=FAULT_FAN_FAILURE,
        device_id=device_id,
        is_abnormal=is_abnormal
    )

    fault = None
    ticket = None
    recurrence = None
    action = None

    if temporal_result["confirmed"]:

        handled = handle_confirmed_fault(
            fault_type=FAULT_FAN_FAILURE,
            room_id=room_id,
            device_id=device_id,
            abnormal_count=temporal_result["abnormal_count"]
        )

        action = handled["action"]
        fault = handled["fault"]
        ticket = handled["ticket"]
        recurrence = handled["recurrence"]

    return {
        "processed": True,
        "status": status,
        "is_abnormal": is_abnormal,
        "temporal": temporal_result,
        "action": action,
        "fault": fault,
        "ticket": ticket,
        "recurrence": recurrence
    }


def process_light_observation(
    room_id
):
    """
    Process a new light-related observation.

    Flow:
    1. Evaluate the current light condition.
    2. Convert it into an abnormal/normal observation.
    3. Add it to the 5-observation temporal window.
    4. Confirm light wastage when 4 out of 5 observations
       are abnormal.
    5. Hand the confirmed fault to handle_confirmed_fault(), which
       creates the fault and ticket, or reopens the original ticket
       when the fault recurs soon after a repair.
    """

    result = evaluate_light_status(
        room_id=room_id
    )

    status = result["status"]

    if status == "WASTAGE_CANDIDATE":
        is_abnormal = True

    elif status == "NORMAL":
        is_abnormal = False

    else:
        return {
            "processed": False,
            "status": "UNKNOWN",
            "temporal": None,
            "fault": None,
            "ticket": None,
            "recurrence": None
        }

    temporal_result = add_observation(
        room_id=room_id,
        fault_type=FAULT_LIGHTS_LEFT_ON,
        device_id=None,
        is_abnormal=is_abnormal
    )

    fault = None
    ticket = None
    recurrence = None
    action = None

    if temporal_result["confirmed"]:

        handled = handle_confirmed_fault(
            fault_type=FAULT_LIGHTS_LEFT_ON,
            room_id=room_id,
            device_id=None,
            abnormal_count=temporal_result["abnormal_count"]
        )

        action = handled["action"]
        fault = handled["fault"]
        ticket = handled["ticket"]
        recurrence = handled["recurrence"]

    return {
        "processed": True,
        "status": status,
        "is_abnormal": is_abnormal,
        "temporal": temporal_result,
        "action": action,
        "fault": fault,
        "ticket": ticket,
        "recurrence": recurrence
    }


def process_electrical_observation(
    room_id
):
    """
    Process a new electrical observation.

    Flow:
    1. Evaluate the latest electrical condition.
    2. Convert it into an abnormal/normal observation.
    3. Add it to the 5-observation temporal window.
    4. Confirm electrical abnormality when 4 out of 5
       observations are abnormal.
    5. Hand the confirmed fault to handle_confirmed_fault(), which
       creates the fault and ticket, or reopens the original ticket
       when the fault recurs soon after a repair.
    """

    result = evaluate_electrical_status(
        room_id=room_id
    )

    status = result["status"]

    if status == "ABNORMALITY_CANDIDATE":
        is_abnormal = True

    elif status == "NORMAL":
        is_abnormal = False

    else:
        return {
            "processed": False,
            "status": "UNKNOWN",
            "temporal": None,
            "fault": None,
            "ticket": None,
            "recurrence": None
        }

    temporal_result = add_observation(
        room_id=room_id,
        fault_type=FAULT_ELECTRICAL_ABNORMALITY,
        device_id=None,
        is_abnormal=is_abnormal
    )

    fault = None
    ticket = None
    recurrence = None
    action = None

    if temporal_result["confirmed"]:

        handled = handle_confirmed_fault(
            fault_type=FAULT_ELECTRICAL_ABNORMALITY,
            room_id=room_id,
            device_id=None,
            abnormal_count=temporal_result["abnormal_count"]
        )

        action = handled["action"]
        fault = handled["fault"]
        ticket = handled["ticket"]
        recurrence = handled["recurrence"]

    return {
        "processed": True,
        "status": status,
        "is_abnormal": is_abnormal,
        "temporal": temporal_result,
        "action": action,
        "fault": fault,
        "ticket": ticket,
        "recurrence": recurrence
    }