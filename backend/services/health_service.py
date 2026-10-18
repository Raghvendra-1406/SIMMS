from datetime import datetime, timezone

from config.settings import (
    HEALTH_NORMAL_MIN,
    HEALTH_WARNING_MIN,
    HEALTH_WEIGHTS,
)

from services.fault_types import (
    FAULT_BOARD_NEEDS_CLEANING,
    FAULT_ELECTRICAL_ABNORMALITY,
    FAULT_FAN_FAILURE,
    FAULT_LIGHT_FAILURE,
)

from database.repositories.health_repository import (
    get_room_health_inputs,
    create_health_score,
    get_health_score_by_id,
    get_latest_health_score,
    get_health_history,
    get_all_latest_health_scores,
)

from database.repositories.fault_repository import (
    get_active_faults_by_room,
)

from database.repositories.sensor_repository import (
    get_latest_sensor_observation,
)

from database.repositories.vision_repository import (
    get_latest_vision_observation,
)

from database.repositories.room_repository import (
    get_room_by_id,
)


# ---------------------------------------------------------
# Classroom Infrastructure Health Score (Plan v2 §10)
#
#   CIHS = 100 - sum(weight x penalty)      each penalty 0..100
#
#   electrical   faulty fans / tubes as a share of all of them;
#                an active electrical abnormality is at least 60
#   board        board waiting to be cleaned: 40, rising to 100
#                as the fault ages to 24 h
#   maintenance  active tickets weighted by priority (H 40 / M 20 /
#                L 10) and age (x1 new .. x2 at 24 h); x1.5 when the
#                response SLA is missed; x0.5 once resolved and only
#                awaiting verification
#   monitoring   share of the room's ESP32 node / camera offline
#                (replaces the plan's furniture term, not built)
# ---------------------------------------------------------

UNIT_FAULT_TYPES = {FAULT_FAN_FAILURE, FAULT_LIGHT_FAILURE}

PRIORITY_POINTS = {"HIGH": 40, "MEDIUM": 20, "LOW": 10}

ELECTRICAL_ABNORMALITY_PENALTY = 60

BOARD_BASE_PENALTY = 40

MONITORED_KINDS = {"SENSOR_NODE", "CAMERA"}

COMPONENT_LABELS = {
    "electrical": "Fans and lights",
    "board": "Board",
    "maintenance": "Open tickets",
    "monitoring": "Monitoring devices",
}


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def get_room_health_data(room_id):
    validate_room_exists(room_id)

    active_faults = get_active_faults_by_room(
        room_id
    )

    environment_observation = get_latest_sensor_observation(
        room_id=room_id,
        observation_type="ENVIRONMENT"
    )

    electrical_observation = get_latest_sensor_observation(
        room_id=room_id,
        observation_type="ELECTRICAL"
    )

    occupancy_observation = get_latest_vision_observation(
        room_id=room_id,
        observation_type="OCCUPANCY"
    )

    return {
        "active_faults": active_faults,
        "environment": environment_observation,
        "electrical": electrical_observation,
        "occupancy": occupancy_observation,
    }


def extract_environment_data(observation):
    if observation is None:
        return {
            "temperature": None,
            "humidity": None,
        }

    data = observation[5]

    return {
        "temperature": data.get("temperature"),
        "humidity": data.get("humidity"),
    }


def extract_power(electrical_observation):
    if electrical_observation is None:
        return None

    data = electrical_observation[5]

    circuits = data.get("circuits")

    if isinstance(circuits, dict):
        main = circuits.get("MAIN")

        if isinstance(main, dict) and main.get("power") is not None:
            return main["power"]

        # No main-supply meter: sum the metered circuits.
        return sum(
            float(reading.get("power") or 0)
            for reading in circuits.values()
            if isinstance(reading, dict)
        )

    return data.get("power")


def extract_occupancy(occupancy_observation):
    if occupancy_observation is None:
        return 0

    data = occupancy_observation[5]

    occupancy_count = data.get(
        "occupancy_count"
    )

    if occupancy_count is None:
        return 0

    return occupancy_count


def _time(value):
    """
    JSON timestamps from PostgreSQL -> aware datetime.
    """

    if value is None or isinstance(value, datetime):
        return value

    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))

    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _hours_since(value, now):
    moment = _time(value)

    return max((now - moment).total_seconds() / 3600, 0.0) if moment else 0.0


def electrical_penalty(inputs):
    units = int(inputs.get("fans_total") or 0) + int(inputs.get("lights_total") or 0)
    faults = inputs.get("faults") or []

    faulty = sum(1 for f in faults if f["fault_type"] in UNIT_FAULT_TYPES)
    abnormality = any(f["fault_type"] == FAULT_ELECTRICAL_ABNORMALITY for f in faults)

    if units:
        penalty = 100.0 * min(faulty, units) / units
    else:
        penalty = 100.0 if faulty else 0.0

    if abnormality:
        penalty = max(penalty, ELECTRICAL_ABNORMALITY_PENALTY)

    return penalty, {
        "faulty_units": faulty,
        "units": units,
        "electrical_abnormality": abnormality,
    }


def board_penalty(inputs, now):
    boards = [
        f for f in (inputs.get("faults") or [])
        if f["fault_type"] == FAULT_BOARD_NEEDS_CLEANING
    ]

    if not boards:
        return 0.0, {"pending": False}

    hours = max(_hours_since(f["detected_at"], now) for f in boards)

    penalty = BOARD_BASE_PENALTY + (100 - BOARD_BASE_PENALTY) * min(hours / 24, 1)

    return penalty, {"pending": True, "hours": round(hours, 1)}


def maintenance_penalty(inputs, now):
    total = 0.0
    overdue = 0
    tickets = inputs.get("tickets") or []

    for ticket in tickets:
        points = PRIORITY_POINTS.get(ticket["priority"], PRIORITY_POINTS["MEDIUM"])
        factor = 1 + min(_hours_since(ticket["created_at"], now) / 24, 1)

        due = _time(ticket.get("sla_due_at"))

        if (
            ticket["status"] in {"OPEN", "REOPENED"}
            and not ticket.get("started_at")
            and due is not None
            and due < now
        ):
            factor *= 1.5
            overdue += 1

        if ticket["status"] == "RESOLVED":
            factor *= 0.5

        total += points * factor

    return min(total, 100.0), {"open_tickets": len(tickets), "overdue": overdue}


def monitoring_penalty(inputs):
    nodes = [
        n for n in (inputs.get("nodes") or [])
        if n.get("kind") in MONITORED_KINDS
    ]

    if not nodes:
        return 0.0, {"monitored": False, "offline": 0, "devices": 0}

    offline = sum(1 for n in nodes if n["state"] != "ONLINE")

    return 100.0 * offline / len(nodes), {
        "monitored": True,
        "offline": offline,
        "devices": len(nodes),
    }


def determine_health_status(health_score):
    if health_score >= HEALTH_NORMAL_MIN:
        return "NORMAL"

    if health_score >= HEALTH_WARNING_MIN:
        return "WARNING"

    return "CRITICAL"


def calculate_cihs(inputs, now=None, weights=None):
    """
    Pure scoring from the room's current faults, tickets and nodes.
    Returns (score 0..100, status, components).
    """

    now = now or datetime.now(timezone.utc)
    weights = weights or HEALTH_WEIGHTS

    penalties = {
        "electrical": electrical_penalty(inputs),
        "board": board_penalty(inputs, now),
        "maintenance": maintenance_penalty(inputs, now),
        "monitoring": monitoring_penalty(inputs),
    }

    components = {}
    deduction = 0.0

    for name, (penalty, detail) in penalties.items():
        weight = float(weights.get(name, 0.0))
        points = weight * penalty
        deduction += points

        components[name] = {
            "label": COMPONENT_LABELS[name],
            "penalty": round(penalty, 1),
            "weight": weight,
            "points": round(points, 1),
            **detail,
        }

    score = round(max(0.0, min(100.0, 100.0 - deduction)), 1)

    return score, determine_health_status(score), components


def calculate_room_health(room_id):
    data = get_room_health_data(room_id)

    active_faults = data["active_faults"]

    environment_data = extract_environment_data(
        data["environment"]
    )

    power = extract_power(
        data["electrical"]
    )

    occupancy_count = extract_occupancy(
        data["occupancy"]
    )

    active_fault_count = len(active_faults)

    temperature = environment_data["temperature"]
    humidity = environment_data["humidity"]

    health_score, health_status, components = calculate_cihs(
        get_room_health_inputs(room_id)
    )

    return {
        "room_id": room_id,
        "health_status": health_status,
        "health_score": health_score,
        "active_fault_count": active_fault_count,
        "occupancy_count": occupancy_count,
        "temperature": temperature,
        "humidity": humidity,
        "power": power,
        "components": components,
    }


def create_room_health_score(room_id):
    health_data = calculate_room_health(
        room_id
    )

    return create_health_score(
        room_id=health_data["room_id"],
        health_status=health_data["health_status"],
        health_score=health_data["health_score"],
        active_fault_count=health_data["active_fault_count"],
        occupancy_count=health_data["occupancy_count"],
        temperature=health_data["temperature"],
        humidity=health_data["humidity"],
        power=health_data["power"],
        components=health_data["components"],
    )


def get_health(health_id):
    health = get_health_score_by_id(
        health_id
    )

    if health is None:
        raise ValueError(
            "Health score not found."
        )

    return health


def get_latest_room_health(room_id):
    validate_room_exists(room_id)

    return get_latest_health_score(
        room_id
    )


def get_room_health_history(
    room_id,
    limit=20
):
    validate_room_exists(room_id)

    if limit <= 0:
        raise ValueError(
            "Limit must be greater than zero."
        )

    return get_health_history(
        room_id=room_id,
        limit=limit
    )


def get_latest_health_for_all_rooms():
    return get_all_latest_health_scores()