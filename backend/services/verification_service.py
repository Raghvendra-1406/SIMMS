from database.repositories.fault_repository import (
    get_fault_by_id,
)

from database.repositories.ticket_repository import (
    get_ticket_by_id,
)

from database.repositories.sensor_repository import (
    get_latest_sensor_observation,
)

from database.repositories.vision_repository import (
    get_latest_vision_observation,
)

from database.repositories.ticket_evidence_repository import (
    create_ticket_evidence,
)

from database.repositories.device_repository import (
    get_device_by_id,
)

from services.ticket_service import (
    close_ticket,
    reopen_ticket,
)

from services.fan_service import (
    get_latest_fan_motion_observation,
    extract_fan_current,
    extract_fan_motion,
)

from services.board_service import (
    get_latest_board_observation,
    extract_board_state,
)

from services.temporal_processor import (
    add_observation,
    is_recovered,
    get_recent_window,
    clear_window,
)


FAULT_FAN_FAILURE = "FAN_FAILURE"
FAULT_LIGHTS_LEFT_ON = "LIGHTS_LEFT_ON"
FAULT_ELECTRICAL_ABNORMALITY = "ELECTRICAL_ABNORMALITY"
FAULT_BOARD_NEEDS_CLEANING = "BOARD_NEEDS_CLEANING"


# Separate temporal keys are used for post-repair verification.
# This prevents verification observations from mixing with
# the normal fault-detection windows.

VERIFY_FAN_FAILURE = "FAN_FAILURE_VERIFICATION"
VERIFY_LIGHTS_LEFT_ON = "LIGHTS_LEFT_ON_VERIFICATION"
VERIFY_ELECTRICAL_ABNORMALITY = "ELECTRICAL_ABNORMALITY_VERIFICATION"
VERIFY_BOARD_NEEDS_CLEANING = "BOARD_NEEDS_CLEANING_VERIFICATION"


def get_ticket(ticket_id):
    ticket = get_ticket_by_id(ticket_id)

    if ticket is None:
        raise ValueError("Ticket not found.")

    return ticket


def get_fault_for_ticket(ticket_id):
    ticket = get_ticket(ticket_id)

    fault_id = ticket[1]

    fault = get_fault_by_id(fault_id)

    if fault is None:
        raise ValueError("Fault event not found.")

    return fault


def get_latest_electrical_observation(room_id):
    return get_latest_sensor_observation(
        room_id=room_id,
        observation_type="ELECTRICAL"
    )


def get_latest_light_observation(room_id):
    return get_latest_sensor_observation(
        room_id=room_id,
        observation_type="LIGHT"
    )


def get_latest_occupancy_observation(room_id):
    return get_latest_vision_observation(
        room_id=room_id,
        observation_type="OCCUPANCY"
    )


# ---------------------------------------------------------
# FAN FAILURE VERIFICATION
# ---------------------------------------------------------

def verify_fan_failure(
    room_id,
    device_id
):
    electrical_observation = get_latest_electrical_observation(
        room_id
    )

    vision_observation = get_latest_fan_motion_observation(
        device_id
    )

    if (
        electrical_observation is None
        or vision_observation is None
    ):
        return {
            "verified": False,
            "status": "INSUFFICIENT_DATA",
            "is_abnormal": None,
            "evidence": {}
        }

    fan_current = extract_fan_current(
        electrical_observation
    )

    fan_motion = extract_fan_motion(
        vision_observation
    )

    if fan_current is None or fan_motion is None:
        return {
            "verified": False,
            "status": "INSUFFICIENT_DATA",
            "is_abnormal": None,
            "evidence": {
                "fan_current": fan_current,
                "fan_motion": fan_motion
            }
        }

    if fan_current > 0 and fan_motion:
        return {
            "verified": True,
            "status": "REPAIRED",
            "is_abnormal": False,
            "evidence": {
                "fan_current": fan_current,
                "fan_motion": fan_motion
            }
        }

    return {
        "verified": False,
        "status": "FAULT_PERSISTS",
        "is_abnormal": True,
        "evidence": {
            "fan_current": fan_current,
            "fan_motion": fan_motion
        }
    }


# ---------------------------------------------------------
# LIGHT WASTAGE VERIFICATION
# ---------------------------------------------------------

def verify_light_wastage(room_id):
    light_observation = get_latest_light_observation(
        room_id
    )

    occupancy_observation = get_latest_occupancy_observation(
        room_id
    )

    if (
        light_observation is None
        or occupancy_observation is None
    ):
        return {
            "verified": False,
            "status": "INSUFFICIENT_DATA",
            "is_abnormal": None,
            "evidence": {}
        }

    light_data = light_observation[5]
    occupancy_data = occupancy_observation[5]

    light_state = light_data.get("light_state")

    occupancy_count = occupancy_data.get(
        "occupancy_count"
    )

    if light_state is None or occupancy_count is None:
        return {
            "verified": False,
            "status": "INSUFFICIENT_DATA",
            "is_abnormal": None,
            "evidence": {
                "light_state": light_state,
                "occupancy_count": occupancy_count
            }
        }

    # Lights OFF OR someone is present means there is
    # no light-wastage fault.
    if light_state == "OFF" or occupancy_count > 0:
        return {
            "verified": True,
            "status": "REPAIRED",
            "is_abnormal": False,
            "evidence": {
                "light_state": light_state,
                "occupancy_count": occupancy_count
            }
        }

    return {
        "verified": False,
        "status": "FAULT_PERSISTS",
        "is_abnormal": True,
        "evidence": {
            "light_state": light_state,
            "occupancy_count": occupancy_count
        }
    }


# ---------------------------------------------------------
# ELECTRICAL ABNORMALITY VERIFICATION
# ---------------------------------------------------------

def verify_electrical_abnormality(room_id):
    observation = get_latest_electrical_observation(
        room_id
    )

    if observation is None:
        return {
            "verified": False,
            "status": "INSUFFICIENT_DATA",
            "is_abnormal": None,
            "evidence": {}
        }

    electrical_data = observation[5]

    abnormal_fields = []

    voltage = electrical_data.get("voltage")
    current = electrical_data.get("current")
    power = electrical_data.get("power")
    power_factor = electrical_data.get("power_factor")

    if voltage is not None:
        if voltage < 200 or voltage > 250:
            abnormal_fields.append("voltage")

    if current is not None:
        if current < 0 or current > 20:
            abnormal_fields.append("current")

    if power is not None:
        if power < 0 or power > 5000:
            abnormal_fields.append("power")

    if power_factor is not None:
        if power_factor < 0.5 or power_factor > 1.0:
            abnormal_fields.append("power_factor")

    if not abnormal_fields:
        return {
            "verified": True,
            "status": "REPAIRED",
            "is_abnormal": False,
            "evidence": {
                "data": electrical_data,
                "abnormal_fields": []
            }
        }

    return {
        "verified": False,
        "status": "FAULT_PERSISTS",
        "is_abnormal": True,
        "evidence": {
            "data": electrical_data,
            "abnormal_fields": abnormal_fields
        }
    }


# ---------------------------------------------------------
# BOARD CLEANING VERIFICATION
# ---------------------------------------------------------

def verify_board_cleaning(room_id):
    board_state = extract_board_state(
        get_latest_board_observation(room_id)
    )

    if board_state is None:
        return {
            "verified": False,
            "status": "INSUFFICIENT_DATA",
            "is_abnormal": None,
            "evidence": {}
        }

    # Clean, or back in normal use: the cleaning was done.
    if board_state in {"CLEAN", "IN_USE"}:
        return {
            "verified": True,
            "status": "REPAIRED",
            "is_abnormal": False,
            "evidence": {
                "board_state": board_state
            }
        }

    return {
        "verified": False,
        "status": "FAULT_PERSISTS",
        "is_abnormal": True,
        "evidence": {
            "board_state": board_state
        }
    }


# ---------------------------------------------------------
# GET VERIFICATION TEMPORAL CONFIGURATION
# ---------------------------------------------------------

def get_verification_configuration(fault_type):
    if fault_type == FAULT_FAN_FAILURE:
        return VERIFY_FAN_FAILURE

    if fault_type == FAULT_LIGHTS_LEFT_ON:
        return VERIFY_LIGHTS_LEFT_ON

    if fault_type == FAULT_ELECTRICAL_ABNORMALITY:
        return VERIFY_ELECTRICAL_ABNORMALITY

    if fault_type == FAULT_BOARD_NEEDS_CLEANING:
        return VERIFY_BOARD_NEEDS_CLEANING

    raise ValueError(
        "Unsupported fault type for verification."
    )


# ---------------------------------------------------------
# MAIN TICKET VERIFICATION
# ---------------------------------------------------------

def verify_ticket(
    ticket_id,
    changed_by=None
):
    ticket = get_ticket(ticket_id)

    ticket_status = ticket[3]

    if ticket_status != "RESOLVED":
        raise ValueError(
            "Only RESOLVED tickets can be verified."
        )

    fault = get_fault_for_ticket(ticket_id)

    room_id = fault[1]
    device_id = fault[2]
    fault_type = fault[3]

    # -----------------------------------------------------
    # DETERMINE CURRENT FAULT CONDITION
    # -----------------------------------------------------

    if fault_type == FAULT_FAN_FAILURE:

        if device_id is None:
            raise ValueError(
                "Fan failure fault does not have a device."
            )

        device = get_device_by_id(device_id)

        if device is None:
            raise ValueError(
                "Fan device not found."
            )

        result = verify_fan_failure(
            room_id=room_id,
            device_id=device_id
        )

    elif fault_type == FAULT_LIGHTS_LEFT_ON:

        result = verify_light_wastage(
            room_id=room_id
        )

    elif fault_type == FAULT_ELECTRICAL_ABNORMALITY:

        result = verify_electrical_abnormality(
            room_id=room_id
        )

    elif fault_type == FAULT_BOARD_NEEDS_CLEANING:

        result = verify_board_cleaning(
            room_id=room_id
        )

    else:
        raise ValueError(
            "Unsupported fault type for verification."
        )

    # -----------------------------------------------------
    # INSUFFICIENT DATA
    # -----------------------------------------------------

    if result["status"] == "INSUFFICIENT_DATA":

        return {
            "verified": False,
            "status": "INSUFFICIENT_DATA",
            "ticket": ticket,
            "evidence": result["evidence"]
        }

    # -----------------------------------------------------
    # VERIFICATION TEMPORAL WINDOW
    # -----------------------------------------------------

    verification_fault_type = get_verification_configuration(
        fault_type
    )

    temporal_result = add_observation(
        room_id=room_id,
        fault_type=verification_fault_type,
        device_id=device_id,
        is_abnormal=result["is_abnormal"]
    )

    # -----------------------------------------------------
    # STORE EACH VERIFICATION OBSERVATION
    # -----------------------------------------------------

    create_ticket_evidence(
        ticket_id=ticket_id,
        evidence_type=fault_type,
        evidence_data={
            **result["evidence"],
            "temporal": temporal_result
        },
        evidence_stage="VERIFICATION"
    )

    # -----------------------------------------------------
    # NOT ENOUGH OBSERVATIONS YET
    # -----------------------------------------------------

    if temporal_result["window_size"] < 5:

        return {
            "verified": False,
            "status": "VERIFICATION_IN_PROGRESS",
            "ticket": ticket,
            "evidence": result["evidence"],
            "temporal": temporal_result
        }

    # -----------------------------------------------------
    # CHECK RECOVERY
    # -----------------------------------------------------

    recovered = is_recovered(
        room_id=room_id,
        fault_type=verification_fault_type,
        device_id=device_id
    )

    recent_window = get_recent_window(
        room_id=room_id,
        fault_type=verification_fault_type,
        device_id=device_id
    )

    # -----------------------------------------------------
    # REPAIR SUCCESSFUL
    # -----------------------------------------------------

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

        clear_window(
            room_id=room_id,
            fault_type=verification_fault_type,
            device_id=device_id
        )

        return {
            "verified": True,
            "status": "CLOSED",
            "ticket": ticket,
            "evidence": result["evidence"],
            "temporal": {
                "window": recent_window,
                "window_size": len(recent_window),
                "recovered": True
            }
        }

    # -----------------------------------------------------
    # REPAIR FAILED
    # -----------------------------------------------------

    ticket = reopen_ticket(
        ticket_id=ticket_id,
        changed_by=changed_by,
        note=(
            "Post-repair verification failed. "
            "Fault persists in the verification window."
        )
    )

    clear_window(
        room_id=room_id,
        fault_type=verification_fault_type,
        device_id=device_id
    )

    return {
        "verified": False,
        "status": "REOPENED",
        "ticket": ticket,
        "evidence": result["evidence"],
        "temporal": {
            "window": recent_window,
            "window_size": len(recent_window),
            "recovered": False
        }
    }
