import json
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from config.settings import (
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
)

from mqtt.connection import (
    configure_client,
)

from mqtt.topics import (
    status_topic,
    vision_topic,
)


CAMERA_DEVICE_NAME = "Camera"

# Offline buffering (Plan v2 §16 T12): observations taken while the
# broker is unreachable are kept and replayed on reconnect. About 4
# messages per 30 s cycle -> 500 messages ~ 1 hour. Oldest dropped.
BUFFER_MAX_MESSAGES = 500


class VisionPublisher:
    """
    Publishes vision observations and camera status to MQTT.

    Message shapes match the ESP32 virtual camera
    (firmware/simms_node) and backend/scripts/fake_node.py.

    Responsibilities:
    - Connect to the MQTT broker, with a last-will OFFLINE status
    - Publish occupancy, board and per-fan motion observations
    - Publish ONLINE / OFFLINE camera status
    - Buffer observations while the broker is unreachable and
      replay them (marked "buffered") once it is back

    Does NOT:
    - Access the camera or vision models
    - Write to PostgreSQL
    - Perform fault confirmation or create tickets
    """

    def __init__(
        self,
        room_name,
        node_id=None,
        broker_host=MQTT_BROKER_HOST,
        broker_port=MQTT_BROKER_PORT
    ):
        self.room_name = room_name
        self.node_id = node_id or f"camera-{room_name}"

        self.broker_host = broker_host
        self.broker_port = broker_port

        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"{self.node_id}-{uuid.uuid4().hex[:6]}",
        )

        configure_client(self.client)

        # If the runtime dies, the broker reports the camera OFFLINE.
        self.client.will_set(
            status_topic(room_name, self.node_id),
            json.dumps({"state": "OFFLINE", "kind": "CAMERA"}),
            qos=1,
            retain=True,
        )

        self.client.reconnect_delay_set(min_delay=1, max_delay=30)

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect

        # Started (loop running); the link itself may still be down.
        self.connected = False

        self._buffer = deque(maxlen=BUFFER_MAX_MESSAGES)
        self._buffer_lock = threading.Lock()
        self._dropped = 0

    def connect(self):
        """
        Start connecting in the background. The runtime does not wait
        for the broker: observations are buffered until it is reachable.
        """

        if self.connected:
            return

        self.client.connect_async(
            self.broker_host,
            self.broker_port,
            keepalive=30
        )

        self.client.loop_start()

        self.connected = True

        print(
            f"Vision MQTT publisher connecting to "
            f"{self.broker_host}:{self.broker_port} as {self.node_id}"
        )

    def wait_until_connected(self, timeout=10):
        """
        Block until the broker accepts the connection (scripts that
        publish once and exit). Returns True when connected.
        """

        deadline = time.monotonic() + timeout

        while time.monotonic() < deadline:
            if self.client.is_connected():
                return True
            time.sleep(0.1)

        return False

    @property
    def buffered_count(self):
        return len(self._buffer)

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code.is_failure:
            print(f"MQTT connection refused: {reason_code}")
            return

        print("MQTT connected.")

        self._flush_buffer()

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):
        print(f"MQTT disconnected ({reason_code}); buffering observations.")

    def _flush_buffer(self):
        """
        Replay buffered observations oldest first. Their own
        timestamps say when they were taken; "buffered" tells the
        backend not to vote with them.
        """

        replayed = 0

        while self.client.is_connected():
            with self._buffer_lock:
                if not self._buffer:
                    break
                topic, payload = self._buffer.popleft()

            result = self.client.publish(
                topic,
                json.dumps({**payload, "buffered": True}),
                qos=1,
            )

            if result.rc != mqtt.MQTT_ERR_SUCCESS:
                with self._buffer_lock:
                    self._buffer.appendleft((topic, payload))
                break

            replayed += 1

        if replayed:
            print(
                f"Replayed {replayed} buffered observations"
                + (f" ({self._dropped} dropped while offline)." if self._dropped else ".")
            )
            self._dropped = 0

    def publish_status(self, online, **details):
        # Status is retained and only meaningful live: never buffered
        # (the broker's last-will covers an unreachable camera).
        if not self.client.is_connected():
            return

        self._publish(
            status_topic(self.room_name, self.node_id),
            {
                "state": "ONLINE" if online else "OFFLINE",
                "kind": "CAMERA",
                **details,
            },
            retain=True,
        )

    def publish_vision_result(self, vision_result):
        """
        Publish one VisionRuntime result:

        {
            "calibration_version": 1,
            "occupancy": {"person_count": 3, "total_seats": 40, ...},
            "fans": [{"device_id": 10, "running": False,
                      "motion_score": 0.01, "confidence": 0.91}],
            "lights": [{"device_id": 20, "lit": True,
                        "brightness": 0.9, "confidence": 1.0}],
            "board": {"state": "DIRTY", "ink_ratio": 0.31,
                      "confidence": 1.0} or None
        }
        """

        if not self.connected:
            raise RuntimeError(
                "MQTT publisher is not started; call connect() first."
            )

        topic = vision_topic(self.room_name)

        common = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "node_id": self.node_id,
            "calibration_version": vision_result.get(
                "calibration_version"
            ),
        }

        occupancy = vision_result.get("occupancy", {})
        person_count = occupancy.get("person_count")

        if person_count is not None:
            payload = {
                **common,
                "device_name": CAMERA_DEVICE_NAME,
                "occupancy_count": person_count,
            }

            for key in (
                "total_seats",
                "occupied_seats",
                "empty_seats",
                "occupancy_ratio",
                "seat_states",
            ):
                if key in occupancy:
                    payload[key] = occupancy[key]

            self._publish(topic, payload)

        board = vision_result.get("board")

        if board is not None:
            self._publish(topic, {
                **common,
                "device_name": CAMERA_DEVICE_NAME,
                "board": board,
            })

        # One message per unit kind, covering every fan / tube light
        # (the backend compares them with the circuit current).
        fans = [
            fan for fan in vision_result.get("fans", [])
            if fan.get("device_id") is not None
        ]

        if fans:
            self._publish(topic, {**common, "fans": fans})

        lights = [
            light for light in vision_result.get("lights", [])
            if light.get("device_id") is not None
        ]

        if lights:
            self._publish(topic, {**common, "lights": lights})

    def _publish(self, topic, payload, retain=False):
        # Catch up on anything buffered first, so order is kept.
        if self._buffer and self.client.is_connected():
            self._flush_buffer()

        result = None

        if self.client.is_connected():
            result = self.client.publish(
                topic,
                json.dumps(payload),
                qos=1,
                retain=retain,
            )

        if result is not None and result.rc == mqtt.MQTT_ERR_SUCCESS:
            return

        if retain:
            return

        with self._buffer_lock:
            if len(self._buffer) == self._buffer.maxlen:
                self._dropped += 1

            self._buffer.append((topic, payload))

    def disconnect(self, publish_offline=True):
        if not self.connected:
            return

        if publish_offline:
            self.publish_status(False)

        self.client.loop_stop()
        self.client.disconnect()

        self.connected = False

        print("Vision MQTT publisher disconnected.")
