import threading

from collections import deque
from datetime import datetime, timezone

WINDOW_SIZE = 5
CONFIRMATION_THRESHOLD = 4
RECOVERY_THRESHOLD = 3


# Once confirmed, a fault is re-checked against the database only
# every RECHECK_EVERY confirmed observations (the first one always
# runs). Saves the fault/ticket transaction on every message while
# a fault persists.
RECHECK_EVERY = 12


_windows = {}

# key -> arrival time of each vote in the window (same length/order),
# so a confirmed fault can report when its abnormal run began.
_vote_times = {}

# key -> consecutive observations for which the window was confirmed
_confirmed_streaks = {}

# key -> whether the window was "recovered" (>= RECOVERY_THRESHOLD
# normal) after the previous observation
_recovered_states = {}

# Windows are shared by the MQTT subscriber thread and API
# request threads (verification, ticket resolution).
# RLock because the public helpers call get_or_create_window.
_windows_lock = threading.RLock()


def get_window_key(
    room_id,
    fault_type,
    device_id=None
):
    return (
        room_id,
        fault_type,
        device_id
    )


def get_or_create_window(
    room_id,
    fault_type,
    device_id=None
):
    key = get_window_key(
        room_id=room_id,
        fault_type=fault_type,
        device_id=device_id
    )

    with _windows_lock:
        if key not in _windows:
            _windows[key] = deque(
                maxlen=WINDOW_SIZE
            )

        return _windows[key]


def add_observation(
    room_id,
    fault_type,
    is_abnormal,
    device_id=None
):
    with _windows_lock:
        window = get_or_create_window(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        key = get_window_key(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        times = _vote_times.setdefault(
            key,
            deque(maxlen=WINDOW_SIZE)
        )

        # Keep both deques aligned (e.g. after clear_window).
        while len(times) > len(window):
            times.popleft()

        while len(times) < len(window):
            times.appendleft(None)

        window.append(bool(is_abnormal))
        times.append(datetime.now(timezone.utc))

        abnormal_count = sum(window)

        confirmed = (
            len(window) == WINDOW_SIZE
            and abnormal_count >= CONFIRMATION_THRESHOLD
        )

        streak = (
            _confirmed_streaks.get(key, 0) + 1
            if confirmed
            else 0
        )

        _confirmed_streaks[key] = streak

        recovered = (
            len(window) == WINDOW_SIZE
            and len(window) - abnormal_count >= RECOVERY_THRESHOLD
        )

        was_recovered = _recovered_states.get(key, False)

        _recovered_states[key] = recovered

        return {
            "window": list(window),
            "window_size": len(window),
            "abnormal_count": abnormal_count,
            "confirmed": confirmed,
            "confirmed_streak": streak,
            # True on the observation that confirms the fault and
            # periodically afterwards: when the caller should act.
            "needs_handling": (
                confirmed
                and streak % RECHECK_EVERY == 1
            ),
            # True on the observation where the condition clears
            # (Plan v2 §7.1 recovery threshold): when the caller
            # should check for auto-resolution.
            "newly_recovered": recovered and not was_recovered,
            # Arrival time of the earliest abnormal vote in a
            # confirmed window: the fault's onset as the system saw
            # it, used for detection-latency statistics.
            "onset_at": (
                min(
                    (
                        ts
                        for vote, ts in zip(window, times)
                        if vote and ts is not None
                    ),
                    default=None
                )
                if confirmed
                else None
            ),
        }


def is_confirmed(
    room_id,
    fault_type,
    device_id=None
):
    with _windows_lock:
        window = get_or_create_window(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        abnormal_count = sum(window)

        return (
            len(window) == WINDOW_SIZE
            and abnormal_count >= CONFIRMATION_THRESHOLD
        )


def get_abnormal_count(
    room_id,
    fault_type,
    device_id=None
):
    with _windows_lock:
        window = get_or_create_window(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        return sum(window)


def get_recent_window(
    room_id,
    fault_type,
    device_id=None
):
    with _windows_lock:
        window = get_or_create_window(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        return list(window)


def is_recovered(
    room_id,
    fault_type,
    device_id=None
):
    with _windows_lock:
        window = get_or_create_window(
            room_id=room_id,
            fault_type=fault_type,
            device_id=device_id
        )

        normal_count = len(window) - sum(window)

        return (
            len(window) == WINDOW_SIZE
            and normal_count >= RECOVERY_THRESHOLD
        )


def clear_window(
    room_id,
    fault_type,
    device_id=None
):
    key = get_window_key(
        room_id=room_id,
        fault_type=fault_type,
        device_id=device_id
    )

    with _windows_lock:
        _windows.pop(key, None)
        _vote_times.pop(key, None)
        _confirmed_streaks.pop(key, None)
        _recovered_states.pop(key, None)
