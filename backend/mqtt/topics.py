BASE_TOPIC = "classroom"


def sensor_topic(room_name):
    return f"{BASE_TOPIC}/{room_name}/sensors"


def vision_topic(room_name):
    return f"{BASE_TOPIC}/{room_name}/vision"


def health_topic(room_name):
    return f"{BASE_TOPIC}/{room_name}/health"


def all_room_topics(room_name):
    return [
        sensor_topic(room_name),
        vision_topic(room_name),
        health_topic(room_name),
    ]