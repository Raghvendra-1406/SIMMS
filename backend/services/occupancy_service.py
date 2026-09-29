from database.repositories.vision_repository import (
    get_room_vacancy,
)


# Occupancy readings older than this are treated as missing
# (camera stopped publishing).
MAX_OCCUPANCY_AGE_MINUTES = 5


def get_vacancy(room_id):
    """
    Whether the room is occupied, and for how long it has been
    vacant, from recent OCCUPANCY observations.

    Returns:
        {"occupied": bool | None, "vacant_minutes": float | None}
        occupied is None when there is no recent occupancy data.
    """

    vacancy = get_room_vacancy(room_id)

    if vacancy is None:
        return {
            "occupied": None,
            "vacant_minutes": None,
        }

    latest_count, latest_age, vacant_minutes = vacancy

    if latest_age > MAX_OCCUPANCY_AGE_MINUTES:
        return {
            "occupied": None,
            "vacant_minutes": None,
        }

    return {
        "occupied": latest_count > 0,
        "vacant_minutes": (
            round(vacant_minutes, 1)
            if vacant_minutes is not None
            else None
        ),
    }
