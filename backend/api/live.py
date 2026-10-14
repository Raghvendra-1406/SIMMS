from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth_dependencies import (
    get_current_user,
)

from database.repositories.live_repository import (
    get_live_rooms,
)

from database.repositories.circuit_baseline_repository import (
    get_all_baselines,
)

from services.circuit_service import (
    FANS,
    LIGHTS,
    MAIN,
    MAX_READING_AGE_MINUTES,
    UNIT_CIRCUITS,
    get_circuit_reading,
    summarise_circuit,
)

from services.unit_service import (
    MAX_VISION_AGE_MINUTES,
    UNIT_KINDS,
    classify_units,
    describe,
    unit_state,
)

from mqtt.subscriber import (
    is_connected,
)


router = APIRouter(
    prefix="/live",
    tags=["Live Monitoring"],
    dependencies=[Depends(get_current_user)]
)


# live key -> unit kind
UNIT_LISTS = {
    "fans": "FAN",
    "lights": "LIGHT",
}


def _age_minutes(server_time, timestamp):
    if not timestamp:
        return None

    return (server_time - datetime.fromisoformat(timestamp)).total_seconds() / 60


def enrich_room(room, baselines):
    """
    Add circuit summaries and per-unit states to a live room, using
    the same rules as fault detection (services.unit_service).
    """

    server_time = datetime.fromisoformat(room["server_time"])

    electrical = (room.get("sensors") or {}).get("ELECTRICAL")

    electrical_data = None

    if electrical:
        age = _age_minutes(server_time, electrical["observed_at"])

        if age is not None and age <= MAX_READING_AGE_MINUTES:
            electrical_data = electrical["data"]

    room_baselines = baselines.get(room["room_id"], {})

    main = get_circuit_reading(electrical_data, MAIN)

    circuits = {
        MAIN: {
            "current": main.get("current") if main else None,
            "power": main.get("power") if main else None,
            "power_factor": main.get("power_factor") if main else None,
            "energy": main.get("energy") if main else None,
        },
    }

    unit_checks = {}

    for list_key, kind in UNIT_LISTS.items():
        config = UNIT_KINDS[kind]
        circuit = config["circuit"]

        units = room.get(list_key) or []
        active = [unit for unit in units if unit["status"] == "ACTIVE"]

        learned = room_baselines.get(circuit)

        baseline = (
            (learned[0], learned[1], True)
            if learned
            else (UNIT_CIRCUITS[circuit]["default_unit_a"], 0.0, False)
        )

        summary = summarise_circuit(
            reading=get_circuit_reading(electrical_data, circuit),
            units_total=len(active),
            baseline=baseline
        )

        circuits[circuit] = summary

        states = {}

        for unit in active:
            age = _age_minutes(server_time, unit.get("observed_at"))
            fresh = age is not None and age <= MAX_VISION_AGE_MINUTES

            states[unit["device_id"]] = (
                unit_state(unit.get("data"), kind) if fresh else None
            )

        # Same rule as detection: no unit check on an overloaded circuit.
        result = classify_units(
            None if summary["overloaded"] else summary["powered_units"],
            states
        )

        names = {unit["device_id"]: unit["device_name"] for unit in active}

        for unit in units:
            state = states.get(unit["device_id"])
            unit["state"] = (
                "WORKING" if state is True
                else "NOT_WORKING" if state is False
                else "UNKNOWN"
            )
            unit["suspect"] = unit["device_id"] in result["suspects"]
            unit["failed"] = unit["suspect"] and result["pinpointed"]

        unit_checks[list_key] = {
            "status": result["status"],
            "summary": describe(kind, result, names),
            "powered_units": result["powered_units"],
            "working_units": len(result["working"]),
            "units_total": len(active),
            "faulty_count": result["faulty_count"],
            "pinpointed": result["pinpointed"],
        }

    room["circuits"] = circuits
    room["unit_checks"] = unit_checks

    return room


@router.get("/rooms")
def live_rooms():
    """
    Latest state of every room in one call, for the live monitor:
    circuit readings, per-unit fan / tube-light state, occupancy,
    board, node status, active faults and health.
    """

    baselines = get_all_baselines()

    return {
        "mqtt_connected": is_connected(),
        "rooms": [
            enrich_room(room, baselines)
            for room in get_live_rooms()
        ],
    }


@router.get("/rooms/{room_id}")
def live_room(room_id: int):
    rooms = get_live_rooms(room_id)

    if not rooms:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found."
        )

    return {
        "mqtt_connected": is_connected(),
        "room": enrich_room(rooms[0], get_all_baselines()),
    }
