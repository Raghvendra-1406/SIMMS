import json
import uuid
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


class VisionPublisher:
    """
    Publishes vision observations and camera status to MQTT.

    Message shapes match the ESP32 virtual camera
    (firmware/simms_node) and backend/scripts/fake_node.py.

    Responsibilities:
    - Connect to the MQTT broker, with a last-will OFFLINE status
    - Publish occupancy, board and per-fan motion observations
    - Publish ONLINE / OFFLINE camera status

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

        self.connected = False

    def connect(self):
        if self.connected:
            return

        self.client.connect(
            self.broker_host,
            self.broker_port,
            keepalive=30
        )

        self.client.loop_start()

        self.connected = True

        print(
            f"Vision MQTT publisher connected to "
            f"{self.broker_host}:{self.broker_port} as {self.node_id}"
        )

    def publish_status(self, online, **details):
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
            "board": {"state": "DIRTY", "ink_ratio": 0.31,
                      "confidence": 1.0} or None
        }
        """

        if not self.connected:
            raise RuntimeError(
                "MQTT publisher is not connected."
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

        for fan in vision_result.get("fans", []):
            device_id = fan.get("device_id")

            if device_id is None:
                continue

            self._publish(topic, {
                **common,
                "device_id": device_id,
                "fan_motion": {
                    "running": fan.get("running"),
                    "motion_score": fan.get("motion_score"),
                    "confidence": fan.get("confidence"),
                },
            })

    def _publish(self, topic, payload, retain=False):
        message = json.dumps(payload)

        result = self.client.publish(
            topic,
            message,
            qos=1,
            retain=retain,
        )

        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            raise RuntimeError(
                f"Failed to publish MQTT message. "
                f"Return code: {result.rc}"
            )

    def disconnect(self, publish_offline=True):
        if not self.connected:
            return

        if publish_offline:
            self.publish_status(False)

        self.client.loop_stop()
        self.client.disconnect()

        self.connected = False

        print("Vision MQTT publisher disconnected.")
