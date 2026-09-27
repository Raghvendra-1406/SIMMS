import json
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from config.settings import (
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
)

from mqtt.topics import vision_topic

from database.repositories.room_repository import (
    get_room_by_id,
)


class VisionPublisher:
    """
    Publishes vision observations to the SIMMS MQTT broker.

    Responsibilities:
    - Connect to the MQTT broker
    - Convert room_id to room_name
    - Publish occupancy observations
    - Publish fan motion observations

    Does NOT:
    - Access the camera
    - Access vision models
    - Load calibration
    - Write directly to PostgreSQL
    - Perform fault confirmation
    - Create faults
    - Create tickets
    """

    def __init__(
        self,
        broker_host=MQTT_BROKER_HOST,
        broker_port=MQTT_BROKER_PORT
    ):
        self.broker_host = broker_host
        self.broker_port = broker_port

        self.client = mqtt.Client()

        self.connected = False

    def connect(self):
        """
        Connect to the MQTT broker.
        """

        if self.connected:
            return

        self.client.connect(
            self.broker_host,
            self.broker_port,
            60
        )

        self.client.loop_start()

        self.connected = True

        print(
            f"Vision MQTT publisher connected to "
            f"{self.broker_host}:{self.broker_port}"
        )

    def publish_vision_result(
        self,
        vision_result
    ):
        """
        Convert and publish a VisionRuntime result.

        Expected input:

        {
            "room_id": 1,
            "calibration_version": 1,
            "occupancy": {
                "person_count": 3
            },
            "fans": [
                {
                    "device_id": 10,
                    "running": False,
                    "motion_score": 0.01,
                    "confidence": 0.91
                }
            ]
        }
        """

        if not self.connected:
            raise RuntimeError(
                "MQTT publisher is not connected."
            )

        room_id = vision_result.get(
            "room_id"
        )

        if room_id is None:
            raise ValueError(
                "Vision result does not contain room_id."
            )

        room = get_room_by_id(
            room_id
        )

        if room is None:
            raise ValueError(
                f"Room {room_id} does not exist."
            )

        room_name = room[1]

        topic = vision_topic(
            room_name
        )

        calibration_version = (
            vision_result.get(
                "calibration_version"
            )
        )

        timestamp = datetime.now(
            timezone.utc
        ).isoformat()

        # -------------------------
        # OCCUPANCY
        # -------------------------

        occupancy = vision_result.get(
            "occupancy",
            {}
        )

        person_count = occupancy.get(
            "person_count"
        )

        if person_count is not None:

            occupancy_payload = {
                "timestamp": timestamp,
                "occupancy_count": person_count,
                "calibration_version": (
                    calibration_version
                )
            }

            self._publish(
                topic=topic,
                payload=occupancy_payload
            )

        # -------------------------
        # FAN MOTION
        # -------------------------

        fans = vision_result.get(
            "fans",
            []
        )

        for fan in fans:

            device_id = fan.get(
                "device_id"
            )

            if device_id is None:
                continue

            fan_payload = {
                "timestamp": timestamp,
                "device_id": device_id,
                "fan_motion": {
                    "running": fan.get(
                        "running"
                    ),
                    "motion_score": fan.get(
                        "motion_score"
                    ),
                    "confidence": fan.get(
                        "confidence"
                    )
                },
                "calibration_version": (
                    calibration_version
                )
            }

            self._publish(
                topic=topic,
                payload=fan_payload
            )

    def _publish(
        self,
        topic,
        payload
    ):
        """
        Publish one JSON message to MQTT.
        """

        message = json.dumps(
            payload
        )

        result = self.client.publish(
            topic,
            message,
            qos=1
        )

        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            raise RuntimeError(
                f"Failed to publish MQTT message. "
                f"Return code: {result.rc}"
            )

        print(
            f"Vision message published to "
            f"{topic}: {message}"
        )

    def disconnect(self):
        """
        Disconnect from the MQTT broker.
        """

        if not self.connected:
            return

        self.client.loop_stop()

        self.client.disconnect()

        self.connected = False

        print(
            "Vision MQTT publisher disconnected."
        )
