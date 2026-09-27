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
    detect_fault,
)

from services.ticket_service import (
    create_or_reopen_fault_ticket,
    check_post_repair_recurrence,
)

from database.repositories.fault_repository import (
    update_fault_recurrence_type,
)


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
    5. Create the confirmed fault event.
    6. Check whether the same fault recently occurred after repair.
    7. Store the recurrence classification.
    8. Automatically create a new ticket.
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

    if temporal_result["confirmed"]:

        fault = detect_fault(
            fault_type=FAULT_FAN_FAILURE,
            room_id=room_id,
            device_id=device_id,
            abnormal_count=temporal_result["abnormal_count"]
        )

        if fault is not None:

            fault_id = fault[0]

            recurrence = check_post_repair_recurrence(
                fault_id=fault_id
            )

            update_fault_recurrence_type(
                fault_id=fault_id,
                recurrence_type=recurrence
            )

            try:
                ticket = create_or_reopen_fault_ticket(
                    fault_id=fault_id,
                    recurrence=recurrence
                )

            except ValueError as exc:

                if str(exc) == (
                    "An active ticket already exists "
                    "for this fault."
                ):
                    ticket = None

                else:
                    raise

    return {
        "processed": True,
        "status": status,
        "is_abnormal": is_abnormal,
        "temporal": temporal_result,
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
    5. Create the confirmed fault event.
    6. Check whether the same fault recently occurred after repair.
    7. Store the recurrence classification.
    8. Automatically create a new ticket.
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

    if temporal_result["confirmed"]:

        fault = detect_fault(
            fault_type=FAULT_LIGHTS_LEFT_ON,
            room_id=room_id,
            device_id=None,
            abnormal_count=temporal_result["abnormal_count"]
        )

        if fault is not None:

            fault_id = fault[0]

            recurrence = check_post_repair_recurrence(
                fault_id=fault_id
            )

            update_fault_recurrence_type(
                fault_id=fault_id,
                recurrence_type=recurrence
            )

            try:
                ticket = create_or_reopen_fault_ticket(
                    fault_id=fault_id,
                    recurrence=recurrence
                )

            except ValueError as exc:

                if str(exc) == (
                    "An active ticket already exists "
                    "for this fault."
                ):
                    ticket = None

                else:
                    raise

    return {
        "processed": True,
        "status": status,
        "is_abnormal": is_abnormal,
        "temporal": temporal_result,
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
    5. Create the confirmed fault event.
    6. Check whether the same fault recently occurred after repair.
    7. Store the recurrence classification.
    8. Create a new ticket or reopen the existing resolved ticket.
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

    if temporal_result["confirmed"]:

        fault = detect_fault(
            fault_type=FAULT_ELECTRICAL_ABNORMALITY,
            room_id=room_id,
            device_id=None,
            abnormal_count=temporal_result["abnormal_count"]
        )

        if fault is not None:

            fault_id = fault[0]

            recurrence = check_post_repair_recurrence(
                fault_id=fault_id
            )

            update_fault_recurrence_type(
                fault_id=fault_id,
                recurrence_type=recurrence["classification"]
            )

            try:
                ticket = create_or_reopen_fault_ticket(
                    fault_id=fault_id,
                    recurrence=recurrence
                )

            except ValueError as exc:

                if str(exc) == (
                    "An active ticket already exists "
                    "for this fault."
                ):
                    ticket = None

                else:
                    raise

    return {
        "processed": True,
        "status": status,
        "is_abnormal": is_abnormal,
        "temporal": temporal_result,
        "fault": fault,
        "ticket": ticket,
        "recurrence": recurrence
    }