import json

import paho.mqtt.client as mqtt

from config.settings import (
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
)

from mqtt.topics import (
    BASE_TOPIC,
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
)

from database.repositories.room_repository import (
    get_room_by_id,
    get_all_rooms,
)


def get_room_name(room_id):
    room = get_room_by_id(room_id)

    if room is None:
        return None

    return room[1]


def process_sensor_message(room_name, payload):
    room = None

    rooms = get_all_rooms()

    for current_room in rooms:
        if current_room[1] == room_name:
            room = current_room
            break

    if room is None:
        print(
            f"Sensor message ignored. "
            f"Room not found: {room_name}"
        )
        return

    room_id = room[0]

    observed_at = payload.get("timestamp")
    device_id = payload.get("device_id")

    observation_data = {
        key: value
        for key, value in payload.items()
        if key not in {
            "classroom_id",
            "room_id",
            "device_id",
            "timestamp",
        }
    }

    if not observation_data:
        print(
            f"Sensor message ignored. "
            f"No observation data for room: {room_name}"
        )
        return

    observation_type = determine_sensor_observation_type(
        observation_data
    )

    if observation_type is None:
        print(
            f"Sensor message ignored. "
            f"Unable to determine observation type: {room_name}"
        )
        return

    create_sensor_observation(
        room_id=room_id,
        device_id=device_id,
        observed_at=observed_at,
        observation_type=observation_type,
        observation_data=observation_data
    )

    # ---------------------------------------------------------
    # LIGHT WASTAGE PROCESSING
    # ---------------------------------------------------------
    #
    # A new LIGHT observation represents one new observation
    # cycle for the light wastage temporal processor.
    #
    # The light service uses:
    #
    #     light_state
    #     +
    #     latest occupancy_count
    #
    # to determine whether the classroom is currently
    # wasting energy.
    #
    # The temporal processor then handles the 4/5 rule.
    #

    if observation_type == "LIGHT":

        try:
            processing_result = process_light_observation(
                room_id=room_id
            )

            print(
                f"Light processing result: "
                f"{processing_result}"
            )

        except Exception as exc:
            print(
                f"Error processing light observation: {exc}"
            )

    if observation_type == "ELECTRICAL":

        try:
            processing_result = process_electrical_observation(
                room_id=room_id
            )

            print(
                f"Electrical processing result: "
                f"{processing_result}"
            )

        except Exception as exc:
            print(
                f"Error processing electrical observation: {exc}"
            )


def process_vision_message(room_name, payload):
    rooms = get_all_rooms()

    room = None

    for current_room in rooms:
        if current_room[1] == room_name:
            room = current_room
            break

    if room is None:
        print(
            f"Vision message ignored. "
            f"Room not found: {room_name}"
        )
        return

    room_id = room[0]

    observed_at = payload.get("timestamp")
    device_id = payload.get("device_id")

    observation_data = {
        key: value
        for key, value in payload.items()
        if key not in {
            "classroom_id",
            "room_id",
            "device_id",
            "timestamp",
        }
    }

    if not observation_data:
        print(
            f"Vision message ignored. "
            f"No observation data for room: {room_name}"
        )
        return

    observation_type = determine_vision_observation_type(
        observation_data
    )

    if observation_type is None:
        print(
            f"Vision message ignored. "
            f"Unable to determine observation type: {room_name}"
        )
        return

    create_vision_observation(
        room_id=room_id,
        device_id=device_id,
        observed_at=observed_at,
        observation_type=observation_type,
        observation_data=observation_data
    )

    # ---------------------------------------------------------
    # FAN FAILURE PROCESSING
    # ---------------------------------------------------------
    #
    # A new FAN_MOTION observation represents one new
    # observation cycle for the temporal processor.
    #
    # We use the latest electrical observation together
    # with this new vision observation to determine whether
    # the fan is currently abnormal.
    #
    # The temporal processor then handles the 4/5 rule.
    #

    if observation_type == "FAN_MOTION":

        if device_id is None:
            print(
                f"Fan motion observation ignored for "
                f"fault processing. Device ID is required."
            )
            return

        try:
            processing_result = process_fan_observation(
                room_id=room_id,
                device_id=device_id
            )

            print(
                f"Fan processing result: "
                f"{processing_result}"
            )

        except Exception as exc:
            print(
                f"Error processing fan observation: {exc}"
            )


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


def determine_vision_observation_type(data):
    if "occupancy_count" in data:
        return "OCCUPANCY"

    if "fan_motion" in data:
        return "FAN_MOTION"

    return None


def handle_message(client, userdata, message):
    try:
        topic = message.topic

        payload = json.loads(
            message.payload.decode("utf-8")
        )

        topic_parts = topic.split("/")

        if len(topic_parts) != 3:
            print(
                f"Invalid MQTT topic: {topic}"
            )
            return

        if topic_parts[0] != BASE_TOPIC:
            print(
                f"Unknown MQTT base topic: {topic}"
            )
            return

        room_name = topic_parts[1]
        topic_type = topic_parts[2]

        if topic_type == "sensors":
            process_sensor_message(
                room_name=room_name,
                payload=payload
            )

        elif topic_type == "vision":
            process_vision_message(
                room_name=room_name,
                payload=payload
            )

        elif topic_type == "health":
            print(
                f"Health message received "
                f"for room {room_name}: {payload}"
            )

        else:
            print(
                f"Unknown MQTT topic type: {topic_type}"
            )

    except json.JSONDecodeError:
        print(
            f"Invalid JSON received on topic: "
            f"{message.topic}"
        )

    except Exception as exc:
        print(
            f"Error processing MQTT message: {exc}"
        )


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker.")

        client.subscribe(
            f"{BASE_TOPIC}/+/sensors"
        )

        client.subscribe(
            f"{BASE_TOPIC}/+/vision"
        )

        client.subscribe(
            f"{BASE_TOPIC}/+/health"
        )

        print("Subscribed to SIMMS MQTT topics.")

    else:
        print(
            f"MQTT connection failed. Return code: {rc}"
        )


def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(
            "Unexpected MQTT disconnection."
        )


def create_mqtt_client():
    client = mqtt.Client()

    client.on_connect = on_connect
    client.on_message = handle_message
    client.on_disconnect = on_disconnect

    return client


def start_mqtt_subscriber():
    client = create_mqtt_client()

    client.connect(
        MQTT_BROKER_HOST,
        MQTT_BROKER_PORT,
        60
    )

    print(
        f"MQTT subscriber started at "
        f"{MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}"
    )

    client.loop_forever()