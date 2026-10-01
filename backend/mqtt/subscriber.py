import json
import queue
import threading
import time
import uuid
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from config.settings import (
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
    MQTT_CLIENT_ID,
)

from mqtt.connection import (
    configure_client,
)

from mqtt.topics import (
    command_topic,
    parse_topic,
    subscription_topics,
)

from services.sensor_service import (
    create_observation as create_sensor_observation
)

from services.vision_service import (
    create_observation as create_vision_observation
)

from services.fault_processing_service import (
    process_fan_observation,
    process_light_observation,
    process_electrical_observation,
    process_board_observation,
)

from database.repositories.room_repository import (
    get_room_by_name,
)

from database.repositories.device_repository import (
    get_device_by_id,
    get_device_by_room_and_name,
    update_device_last_seen,
)

from database.repositories.node_status_repository import (
    upsert_node_status,
)


# Keys that describe the message rather than the observation.
METADATA_KEYS = {
    "classroom_id",
    "room_id",
    "device_id",
    "device_name",
    "node_id",
    "timestamp",
}

NODE_STATES = {"ONLINE", "OFFLINE"}

# last_seen / node heartbeat writes are throttled per device/node:
# one write per interval is enough and saves database round trips.
LAST_SEEN_WRITE_INTERVAL_SECONDS = 30


# The paho network thread only enqueues messages; one worker
# thread processes them in order. Slow database work therefore
# never blocks MQTT keep-alives or reconnects.
_message_queue = queue.Queue(maxsize=10000)

_client = None

_last_seen_written = {}


def log(message):
    print(f"[mqtt] {message}", flush=True)


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def _should_write(key):
    now = time.monotonic()

    last = _last_seen_written.get(key)

    if last is not None and now - last < LAST_SEEN_WRITE_INTERVAL_SECONDS:
        return False

    _last_seen_written[key] = now

    return True


def resolve_device_id(room_id, payload):
    """
    Device from the payload: device_id, or device_name looked up
    in the room (firmware refers to devices by name).
    Returns None when neither identifies a device in this room.
    """

    device_id = payload.get("device_id")

    if device_id is not None:
        device = get_device_by_id(device_id)

        if device is None or device[1] != room_id:
            log(
                f"Ignoring device_id {device_id}: "
                f"not a device in room {room_id}."
            )
            return None

        return device_id

    device_name = payload.get("device_name")

    if device_name:
        device = get_device_by_room_and_name(
            room_id,
            str(device_name)
        )

        if device is None:
            log(
                f"Unknown device_name '{device_name}' in room "
                f"{room_id}. Add it on the Devices page."
            )
            return None

        return device[0]

    return None


def mark_seen(room_id, device_id, node_id):
    """
    Record that a device and/or node was just heard from.
    """

    if device_id is not None and _should_write(("device", device_id)):
        update_device_last_seen(
            device_id,
            datetime.now(timezone.utc)
        )

    if node_id and _should_write(("node", room_id, node_id)):
        upsert_node_status(
            room_id=room_id,
            node_id=str(node_id),
            state="ONLINE"
        )


def get_observation_data(payload):
    return {
        key: value
        for key, value in payload.items()
        if key not in METADATA_KEYS
    }


# ---------------------------------------------------------
# SENSOR MESSAGES
# ---------------------------------------------------------

def determine_sensor_observation_type(data):
    if any(
        field in data
        for field in {
            "voltage",
            "current",
            "power",
            "power_factor",
            "fan_current",
        }
    ):
        return "ELECTRICAL"

    if any(
        field in data
        for field in {
            "temperature",
            "humidity",
        }
    ):
        return "ENVIRONMENT"

    if "light_state" in data:
        return "LIGHT"

    if "energy" in data:
        return "ENERGY"

    return None


def process_sensor_message(room, payload):
    room_id = room[0]

    observation_data = get_observation_data(payload)

    if not observation_data:
        log(f"Sensor message ignored. No data for room {room[1]}.")
        return

    observation_type = determine_sensor_observation_type(
        observation_data
    )

    if observation_type is None:
        log(
            f"Sensor message ignored. Unknown observation "
            f"type for room {room[1]}: {observation_data}"
        )
        return

    device_id = resolve_device_id(room_id, payload)

    create_sensor_observation(
        room_id=room_id,
        device_id=device_id,
        observed_at=payload.get("timestamp"),
        observation_type=observation_type,
        observation_data=observation_data
    )

    mark_seen(room_id, device_id, payload.get("node_id"))

    # A new LIGHT / ELECTRICAL observation is one observation
    # cycle for its temporal processor (4-of-5 rule).

    if observation_type == "LIGHT":
        report(room, observation_type, process_light_observation(
            room_id=room_id
        ))

    elif observation_type == "ELECTRICAL":
        report(room, observation_type, process_electrical_observation(
            room_id=room_id
        ))

    else:
        report(room, observation_type, None)


# ---------------------------------------------------------
# VISION MESSAGES
# ---------------------------------------------------------

def determine_vision_observation_type(data):
    if "occupancy_count" in data:
        return "OCCUPANCY"

    if "fan_motion" in data:
        return "FAN_MOTION"

    if "board" in data:
        return "BOARD"

    return None


def process_vision_message(room, payload):
    room_id = room[0]

    observation_data = get_observation_data(payload)

    if not observation_data:
        log(f"Vision message ignored. No data for room {room[1]}.")
        return

    observation_type = determine_vision_observation_type(
        observation_data
    )

    if observation_type is None:
        log(
            f"Vision message ignored. Unknown observation "
            f"type for room {room[1]}: {observation_data}"
        )
        return

    device_id = resolve_device_id(room_id, payload)

    if observation_type == "FAN_MOTION" and device_id is None:
        log(
            f"Fan motion ignored for room {room[1]}: "
            f"the message must name a fan device of this room."
        )
        return

    create_vision_observation(
        room_id=room_id,
        device_id=device_id,
        observed_at=payload.get("timestamp"),
        observation_type=observation_type,
        observation_data=observation_data
    )

    mark_seen(room_id, device_id, payload.get("node_id"))

    # A new BOARD / FAN_MOTION observation is one observation
    # cycle for its temporal processor (4-of-5 rule).

    if observation_type == "BOARD":
        report(room, observation_type, process_board_observation(
            room_id=room_id
        ))

    elif observation_type == "FAN_MOTION":
        report(room, observation_type, process_fan_observation(
            room_id=room_id,
            device_id=device_id
        ))

    else:
        report(room, observation_type, None)


# ---------------------------------------------------------
# NODE STATUS MESSAGES
# ---------------------------------------------------------

def process_status_message(room, node_id, payload):
    state = str(payload.get("state", "")).upper()

    if state not in NODE_STATES:
        log(
            f"Status message ignored for node {node_id}: "
            f"state must be ONLINE or OFFLINE."
        )
        return

    details = {
        key: value
        for key, value in payload.items()
        if key not in {
            "state",
            "kind",
            "rssi",
            "uptime_s",
            "fw_version",
            "node_id",
        }
    }

    upsert_node_status(
        room_id=room[0],
        node_id=node_id,
        state=state,
        kind=payload.get("kind"),
        rssi=payload.get("rssi"),
        uptime_s=payload.get("uptime_s"),
        fw_version=payload.get("fw_version"),
        details=details or None
    )

    log(f"{room[1]} node {node_id} is {state}.")


# ---------------------------------------------------------
# DISPATCH
# ---------------------------------------------------------

def report(room, observation_type, result):
    if result is None:
        log(f"{room[1]} {observation_type} stored.")
        return

    temporal = result.get("temporal") or {}

    window = temporal.get("window")

    summary = (
        f"{room[1]} {observation_type}: {result.get('status')}"
    )

    if window is not None:
        summary += (
            f", window {temporal.get('abnormal_count')}/"
            f"{temporal.get('window_size')} abnormal"
        )

    if result.get("action"):
        ticket = result.get("ticket")
        summary += f", {result['action']}"

        if ticket:
            summary += f" ticket #{ticket[0]}"

    log(summary)


def handle_message(topic, raw_payload):
    parsed = parse_topic(topic)

    if parsed is None:
        log(f"Ignoring unexpected topic: {topic}")
        return

    room_name, topic_type, node_id = parsed

    if topic_type == "command":
        return

    # Retained messages are cleared with an empty payload.
    if not raw_payload:
        return

    try:
        payload = json.loads(raw_payload.decode("utf-8"))

    except (UnicodeDecodeError, json.JSONDecodeError):
        log(f"Invalid JSON received on topic: {topic}")
        return

    if not isinstance(payload, dict):
        log(f"Ignoring non-object JSON on topic: {topic}")
        return

    room = get_room_by_name(room_name)

    if room is None:
        log(
            f"Message ignored. Room not found: {room_name}. "
            f"Room names must match exactly (case-sensitive)."
        )
        return

    if topic_type == "sensors":
        process_sensor_message(room, payload)

    elif topic_type == "vision":
        process_vision_message(room, payload)

    elif topic_type == "status":
        process_status_message(room, node_id, payload)


def _worker():
    while True:
        topic, raw_payload = _message_queue.get()

        try:
            handle_message(topic, raw_payload)

        except ValueError as exc:
            log(f"Rejected message on {topic}: {exc}")

        except Exception as exc:
            log(f"Error processing message on {topic}: {exc!r}")

        finally:
            _message_queue.task_done()


# ---------------------------------------------------------
# MQTT CLIENT
# ---------------------------------------------------------

def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        log(f"Connection refused by broker: {reason_code}")
        return

    for topic in subscription_topics():
        client.subscribe(topic, qos=1)

    log(
        f"Connected to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}, "
        f"subscribed to {', '.join(subscription_topics())}"
    )


def on_disconnect(client, userdata, flags, reason_code, properties):
    if reason_code != 0:
        log(
            f"Disconnected from broker ({reason_code}). "
            f"Reconnecting..."
        )


def on_message(client, userdata, message):
    try:
        _message_queue.put_nowait(
            (message.topic, message.payload)
        )

    except queue.Full:
        log(f"Queue full, dropping message on {message.topic}")


def create_mqtt_client():
    # A random suffix keeps two backend processes (e.g. during a
    # --reload restart) from kicking each other off the broker.
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"{MQTT_CLIENT_ID}-{uuid.uuid4().hex[:6]}",
    )

    configure_client(client)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    client.reconnect_delay_set(
        min_delay=1,
        max_delay=30
    )

    return client


def start_mqtt_subscriber():
    """
    Run the MQTT client forever. Retries the first connection
    and reconnects automatically, so the broker may be started
    before or after the backend.
    """

    global _client

    threading.Thread(
        target=_worker,
        name="mqtt-worker",
        daemon=True
    ).start()

    _client = create_mqtt_client()

    _client.connect_async(
        MQTT_BROKER_HOST,
        MQTT_BROKER_PORT,
        keepalive=30
    )

    log(
        f"Connecting to broker at "
        f"{MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}..."
    )

    _client.loop_forever(retry_first_connection=True)


def is_connected():
    return _client is not None and _client.is_connected()


def publish_command(room_name, command):
    """
    Send a command to the room's IoT node (demo panel relays).

    Raises:
        RuntimeError: the backend is not connected to the broker.
    """

    if not is_connected():
        raise RuntimeError(
            "The backend is not connected to the MQTT broker."
        )

    result = _client.publish(
        command_topic(room_name),
        json.dumps(command),
        qos=1
    )

    if result.rc != mqtt.MQTT_ERR_SUCCESS:
        raise RuntimeError(
            f"Failed to publish command (rc={result.rc})."
        )

    log(f"Command sent to {room_name}: {command}")
