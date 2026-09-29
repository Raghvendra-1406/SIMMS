import threading

from config.settings import (
    HEALTH_INTERVAL_SECONDS,
    NODE_OFFLINE_SECONDS,
)

from database.repositories.room_repository import (
    get_all_rooms,
)

from database.repositories.node_status_repository import (
    mark_stale_nodes_offline,
)

from services.health_service import (
    create_room_health_score,
)


# Staleness is checked more often than health is computed, so a
# silent node shows OFFLINE soon after NODE_OFFLINE_SECONDS.
NODE_CHECK_INTERVAL_SECONDS = 15


def log(message):
    print(f"[scheduler] {message}", flush=True)


def compute_health_scores():
    """
    Store a fresh health score for every ACTIVE room.
    """

    for room in get_all_rooms():
        room_id = room[0]
        status = room[6]

        if status != "ACTIVE":
            continue

        try:
            create_room_health_score(room_id)

        except Exception as exc:
            log(f"Health score failed for room {room[1]}: {exc!r}")


def check_stale_nodes():
    for node in mark_stale_nodes_offline(NODE_OFFLINE_SECONDS):
        log(
            f"Node {node[2]} (room {node[1]}) marked OFFLINE: "
            f"nothing heard for {NODE_OFFLINE_SECONDS} s."
        )


def _run(stop_event):
    seconds_since_health = HEALTH_INTERVAL_SECONDS

    while not stop_event.is_set():
        try:
            check_stale_nodes()

            if seconds_since_health >= HEALTH_INTERVAL_SECONDS:
                compute_health_scores()
                seconds_since_health = 0

        except Exception as exc:
            log(f"Background job failed: {exc!r}")

        stop_event.wait(NODE_CHECK_INTERVAL_SECONDS)
        seconds_since_health += NODE_CHECK_INTERVAL_SECONDS


def start_scheduler():
    """
    Start the background jobs thread. Returns the stop event.
    """

    stop_event = threading.Event()

    threading.Thread(
        target=_run,
        args=(stop_event,),
        name="scheduler",
        daemon=True
    ).start()

    log(
        f"Started: health every {HEALTH_INTERVAL_SECONDS} s, "
        f"node offline after {NODE_OFFLINE_SECONDS} s."
    )

    return stop_event
