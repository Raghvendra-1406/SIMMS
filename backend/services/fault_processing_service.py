from services.temporal_processor import (
    add_observation,
)

from services.electrical_service import (
    evaluate_electrical_status,
)

from services.energy_service import (
    evaluate_energy_wastage,
)

from services.circuit_service import (
    get_latest_electrical,
)

from services.unit_service import (
    UNIT_KINDS,
    evaluate_units,
)

from services.board_service import (
    evaluate_board_status,
)

from services.fault_types import (
    FAULT_ELECTRICAL_ABNORMALITY,
    FAULT_ENERGY_WASTAGE,
    FAULT_BOARD_NEEDS_CLEANING,
)

from services.fault_detector import (
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
    abnormal_count,
    details=None
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
            recurrence_type=recurrence["classification"],
            details=details
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
    is_abnormal,
    details=None
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
            abnormal_count=temporal_result["abnormal_count"],
            details=details
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


def process_electrical_observation(
    room_id
):
    """
    A new circuit reading drives two room-level checks:

    - electrical abnormality (supply voltage, overcurrent per circuit,
      power factor)
    - energy wastage (lights / fans powered in a vacant room)
    """

    electrical_data = get_latest_electrical(room_id)

    results = {}

    electrical = evaluate_electrical_status(
        room_id=room_id,
        electrical_data=electrical_data
    )

    if electrical["status"] == "UNKNOWN":
        results["electrical"] = not_processed()

    else:
        results["electrical"] = apply_observation(
            fault_type=FAULT_ELECTRICAL_ABNORMALITY,
            room_id=room_id,
            device_id=None,
            status=electrical["status"],
            is_abnormal=electrical["status"] == "ABNORMALITY_CANDIDATE",
            details={"abnormal": electrical["abnormal_fields"]}
        )

    wastage = evaluate_energy_wastage(
        room_id=room_id,
        electrical_data=electrical_data
    )

    if wastage["status"] == "UNKNOWN":
        results["energy"] = not_processed()

    else:
        results["energy"] = apply_observation(
            fault_type=FAULT_ENERGY_WASTAGE,
            room_id=room_id,
            device_id=None,
            status=wastage["status"],
            is_abnormal=wastage["status"] == "WASTAGE_CANDIDATE",
            details=wastage
        )

    return results


def process_unit_observations(
    room_id,
    kind
):
    """
    New camera readings for every fan (kind FAN) or tube light
    (kind LIGHT) in the room.

    Each unit gets its own vote:
      working                      -> normal
      not working, pinpointed      -> abnormal (that unit has failed)
      not working, not suspected   -> normal (switched off)
      ambiguous / not visible      -> no vote

    When the circuit shows a failed unit but the camera cannot tell
    which of several stopped units it is, a room-level fault
    (device None) is raised instead, naming the candidates.
    """

    config = UNIT_KINDS[kind]
    fault_type = config["fault_type"]

    result = evaluate_units(room_id, kind)

    if result["status"] in {"UNKNOWN", "NO_VISION"}:
        return {"summary": result["summary"], "status": result["status"], "units": {}}

    details = {
        "summary": result["summary"],
        "circuit": config["circuit"],
        "circuit_current": result["circuit"]["current"],
        "powered_units": result["powered_units"],
        "working_units": len(result["working"]),
        "suspects": [result["names"][d] for d in result["suspects"]],
    }

    unit_results = {}

    for device_id, state in result["unit_states"].items():
        if state is True:
            is_abnormal = False

        elif device_id in result["suspects"]:
            if not result["pinpointed"]:
                continue
            is_abnormal = True

        elif state is False:
            is_abnormal = False

        else:
            continue

        unit_results[device_id] = apply_observation(
            fault_type=fault_type,
            room_id=room_id,
            device_id=device_id,
            status="FAILURE_CANDIDATE" if is_abnormal else "NORMAL",
            is_abnormal=is_abnormal,
            details={**details, "unit": result["names"][device_id]}
        )

    ambiguous = result["status"] == "FAULT" and not result["pinpointed"]

    unit_results[None] = apply_observation(
        fault_type=fault_type,
        room_id=room_id,
        device_id=None,
        status="AMBIGUOUS_FAILURE" if ambiguous else "NORMAL",
        is_abnormal=ambiguous,
        details=details
    )

    return {
        "summary": result["summary"],
        "status": result["status"],
        "units": unit_results,
    }


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
