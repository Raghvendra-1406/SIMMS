from config.settings import MQTT_TOPIC_PREFIX


# Topic layout (Plan v2 §14.2), all under an optional prefix:
#
#   [<prefix>/]classroom/<room>/sensors            ESP32 telemetry
#   [<prefix>/]classroom/<room>/vision             camera observations
#   [<prefix>/]classroom/<room>/status/<node_id>   node status (retained,
#                                                  last-will OFFLINE)
#   [<prefix>/]classroom/<room>/command            server -> node
#                                                  (demo panel relays)

BASE_TOPIC = (
    f"{MQTT_TOPIC_PREFIX}/classroom"
    if MQTT_TOPIC_PREFIX
    else "classroom"
)


def sensor_topic(room_name):
    return f"{BASE_TOPIC}/{room_name}/sensors"


def vision_topic(room_name):
    return f"{BASE_TOPIC}/{room_name}/vision"


def status_topic(room_name, node_id):
    return f"{BASE_TOPIC}/{room_name}/status/{node_id}"


def command_topic(room_name):
    return f"{BASE_TOPIC}/{room_name}/command"


def subscription_topics():
    return [
        f"{BASE_TOPIC}/+/sensors",
        f"{BASE_TOPIC}/+/vision",
        f"{BASE_TOPIC}/+/status/+",
    ]


def parse_topic(topic):
    """
    Split a SIMMS topic into (room_name, topic_type, node_id).

    node_id is only set for status topics.
    Returns None for topics outside BASE_TOPIC or with an
    unexpected shape.
    """

    prefix = f"{BASE_TOPIC}/"

    if not topic.startswith(prefix):
        return None

    parts = topic[len(prefix):].split("/")

    if len(parts) == 2 and parts[1] in {"sensors", "vision", "command"}:
        return parts[0], parts[1], None

    if len(parts) == 3 and parts[1] == "status" and parts[2]:
        return parts[0], "status", parts[2]

    return None
