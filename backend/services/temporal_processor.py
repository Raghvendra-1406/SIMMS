from collections import deque

WINDOW_SIZE = 5
CONFIRMATION_THRESHOLD = 4
RECOVERY_THRESHOLD = 3


_windows = {}


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
    window = get_or_create_window(
        room_id=room_id,
        fault_type=fault_type,
        device_id=device_id
    )

    window.append(bool(is_abnormal))

    abnormal_count = sum(window)

    return {
        "window": list(window),
        "window_size": len(window),
        "abnormal_count": abnormal_count,
        "confirmed": (
            len(window) == WINDOW_SIZE
            and abnormal_count >= CONFIRMATION_THRESHOLD
        )
    }


def is_confirmed(
    room_id,
    fault_type,
    device_id=None
):
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

    _windows.pop(key, None)