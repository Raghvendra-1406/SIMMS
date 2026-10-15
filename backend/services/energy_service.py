from config.settings import (
    VACANCY_MINUTES,
)

from database.repositories.room_repository import (
    get_room_by_id,
)

from services.circuit_service import (
    FANS,
    LIGHTS,
    evaluate_circuit,
    get_latest_electrical,
)

from services.occupancy_service import (
    get_vacancy,
)


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def evaluate_energy_wastage(room_id, electrical_data=None):
    """
    Energy wastage (Plan v2 §8.6): lights or fans powered while the
    room has been vacant for at least VACANCY_MINUTES.

    Uses the LIGHTS / FANS circuit meters, so it covers every tube
    light and fan in the room, not a single appliance.
    """

    validate_room_exists(room_id)

    if electrical_data is None:
        electrical_data = get_latest_electrical(room_id)

    lights = evaluate_circuit(room_id, LIGHTS, electrical_data)
    fans = evaluate_circuit(room_id, FANS, electrical_data)

    lights_on = lights["powered_units"]
    fans_on = fans["powered_units"]

    details = {
        "lights_on": lights_on,
        "lights_total": lights["units_total"],
        "fans_on": fans_on,
        "fans_total": fans["units_total"],
        "power_w": sum(
            float(circuit["power"] or 0)
            for circuit in (lights, fans)
        ),
    }

    if lights_on is None and fans_on is None:
        return {"status": "UNKNOWN", **details}

    if not (lights_on or fans_on):
        return {"status": "NORMAL", **details}

    vacancy = get_vacancy(room_id)

    details.update({
        "occupied": vacancy["occupied"],
        "vacant_minutes": vacancy["vacant_minutes"],
    })

    if vacancy["occupied"] is None:
        return {"status": "UNKNOWN", **details}

    if vacancy["occupied"]:
        return {"status": "NORMAL", **details}

    if (
        vacancy["vacant_minutes"] is not None
        and vacancy["vacant_minutes"] >= VACANCY_MINUTES
    ):
        details["summary"] = (
            f"Room empty for {vacancy['vacant_minutes']:g} min with "
            f"{lights_on or 0}/{lights['units_total']} lights and "
            f"{fans_on or 0}/{fans['units_total']} fans on "
            f"({details['power_w']:.0f} W)"
        )

        return {"status": "WASTAGE_CANDIDATE", **details}

    return {"status": "NORMAL", **details}
