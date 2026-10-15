from services.fault_types import (
    FAULT_BOARD_NEEDS_CLEANING,
    FAULT_ELECTRICAL_ABNORMALITY,
    FAULT_ENERGY_WASTAGE,
    FAULT_FAN_FAILURE,
    FAULT_LIGHT_FAILURE,
    FAULT_LIGHTS_LEFT_ON,
)

from services.unit_service import (
    evaluate_units,
    unit_condition,
)

from services.energy_service import (
    evaluate_energy_wastage,
)

from services.electrical_service import (
    evaluate_electrical_status,
)

from services.board_service import (
    evaluate_board_status,
    extract_board_state,
    get_latest_board_observation,
)


UNIT_FAULT_KINDS = {
    FAULT_FAN_FAILURE: "FAN",
    FAULT_LIGHT_FAILURE: "LIGHT",
}


def current_condition(fault_type, room_id, device_id=None, purpose="detect"):
    """
    Is the fault present right now, from the latest readings?

    Returns (abnormal, details):
      abnormal  True (present), False (not present) or None (the
                readings cannot tell, e.g. missing data or the unit
                is switched off)
      details   dict describing what was seen

    purpose="verify" (post-repair verification) differs only for the
    board: a cleaned board counts as repaired even while a lecture
    has started writing on it.
    """

    if fault_type in UNIT_FAULT_KINDS:
        kind = UNIT_FAULT_KINDS[fault_type]
        result = evaluate_units(room_id, kind)

        return (
            unit_condition(room_id, kind, device_id),
            {
                "summary": result["summary"],
                "powered_units": result["powered_units"],
                "working": len(result["working"]),
                "suspects": [
                    result["names"].get(d, d) for d in result["suspects"]
                ],
            },
        )

    if fault_type in {FAULT_ENERGY_WASTAGE, FAULT_LIGHTS_LEFT_ON}:
        result = evaluate_energy_wastage(room_id)
        status = result["status"]

        return (
            None if status == "UNKNOWN" else status == "WASTAGE_CANDIDATE",
            result,
        )

    if fault_type == FAULT_ELECTRICAL_ABNORMALITY:
        result = evaluate_electrical_status(room_id)
        status = result["status"]

        return (
            None if status == "UNKNOWN" else status == "ABNORMALITY_CANDIDATE",
            {"abnormal": result["abnormal_fields"]},
        )

    if fault_type == FAULT_BOARD_NEEDS_CLEANING:
        if purpose == "verify":
            state = extract_board_state(
                get_latest_board_observation(room_id)
            )

            return (
                None if state is None else state == "DIRTY",
                {"board_state": state},
            )

        result = evaluate_board_status(room_id)
        status = result["status"]

        return (
            None if status == "UNKNOWN" else status == "CLEANING_CANDIDATE",
            result,
        )

    raise ValueError("Unsupported fault type.")
