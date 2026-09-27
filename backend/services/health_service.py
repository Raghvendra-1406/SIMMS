from database.repositories.health_repository import (
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


HEALTH_EXCELLENT_MIN = 90
HEALTH_GOOD_MIN = 75
HEALTH_WARNING_MIN = 50

TEMPERATURE_MIN = 18.0
TEMPERATURE_MAX = 35.0

HUMIDITY_MIN = 30.0
HUMIDITY_MAX = 70.0


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


def calculate_environment_score(
    temperature,
    humidity
):
    score = 100.0

    if temperature is not None:
        if (
            temperature < TEMPERATURE_MIN
            or temperature > TEMPERATURE_MAX
        ):
            score -= 15

    if humidity is not None:
        if (
            humidity < HUMIDITY_MIN
            or humidity > HUMIDITY_MAX
        ):
            score -= 15

    return max(score, 0.0)


def calculate_fault_score(active_fault_count):
    if active_fault_count == 0:
        return 100.0

    if active_fault_count == 1:
        return 75.0

    if active_fault_count == 2:
        return 50.0

    if active_fault_count >= 3:
        return 25.0

    return 100.0


def calculate_health_score(
    active_fault_count,
    temperature,
    humidity
):
    fault_score = calculate_fault_score(
        active_fault_count
    )

    environment_score = calculate_environment_score(
        temperature=temperature,
        humidity=humidity
    )

    health_score = (
        fault_score * 0.70
        + environment_score * 0.30
    )

    return round(health_score, 2)


def determine_health_status(health_score):
    if health_score >= HEALTH_EXCELLENT_MIN:
        return "EXCELLENT"

    if health_score >= HEALTH_GOOD_MIN:
        return "GOOD"

    if health_score >= HEALTH_WARNING_MIN:
        return "WARNING"

    return "CRITICAL"


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

    health_score = calculate_health_score(
        active_fault_count=active_fault_count,
        temperature=temperature,
        humidity=humidity
    )

    health_status = determine_health_status(
        health_score
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