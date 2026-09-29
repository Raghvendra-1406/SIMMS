from datetime import datetime, timezone

from config.settings import (
    VACANCY_MINUTES,
    MIN_VOTE_CONFIDENCE,
)

from database.repositories.vision_repository import (
    get_latest_vision_observation,
)

from database.repositories.room_repository import (
    get_room_by_id,
)

from services.occupancy_service import (
    get_vacancy,
)


BOARD_CLEANING_THRESHOLD = 4

# Readings older than this are treated as missing
# (camera stopped publishing).
MAX_OBSERVATION_AGE_MINUTES = 5


def validate_room_exists(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        raise ValueError("Room not found.")

    return room


def get_latest_board_observation(room_id):
    return get_latest_vision_observation(
        room_id=room_id,
        observation_type="BOARD"
    )


def extract_board_state(observation):
    """
    Read the board state from a BOARD observation.

    Returns None when the reading cannot be used:
    missing, stale, occluded or below MIN_CONFIDENCE.
    """

    if observation is None:
        return None

    observed_at = observation[3]

    age_minutes = (
        datetime.now(timezone.utc) - observed_at
    ).total_seconds() / 60

    if age_minutes > MAX_OBSERVATION_AGE_MINUTES:
        return None

    board = observation[5].get("board")

    if not isinstance(board, dict):
        return None

    state = board.get("state")

    if state not in {"CLEAN", "IN_USE", "DIRTY"}:
        return None

    if (board.get("confidence") or 0) < MIN_VOTE_CONFIDENCE:
        return None

    return state


def evaluate_board_status(room_id):
    validate_room_exists(room_id)

    board_state = extract_board_state(
        get_latest_board_observation(room_id)
    )

    if board_state is None:
        return {
            "status": "UNKNOWN",
            "board_state": None,
            "occupied": None,
            "vacant_minutes": None,
        }

    if board_state in {"CLEAN", "IN_USE"}:
        return {
            "status": "NORMAL",
            "board_state": board_state,
            "occupied": None,
            "vacant_minutes": None,
        }

    vacancy = get_vacancy(room_id)

    result = {
        "board_state": board_state,
        "occupied": vacancy["occupied"],
        "vacant_minutes": vacancy["vacant_minutes"],
    }

    if vacancy["occupied"] is None:
        return {
            "status": "UNKNOWN",
            **result,
        }

    # A written board during a lecture is normal.
    if vacancy["occupied"]:
        return {
            "status": "NORMAL",
            **result,
        }

    if (
        vacancy["vacant_minutes"] is not None
        and vacancy["vacant_minutes"] >= VACANCY_MINUTES
    ):
        return {
            "status": "CLEANING_CANDIDATE",
            **result,
        }

    return {
        "status": "NORMAL",
        **result,
    }


def is_board_cleaning_candidate(room_id):
    result = evaluate_board_status(room_id)

    return result["status"] == "CLEANING_CANDIDATE"
