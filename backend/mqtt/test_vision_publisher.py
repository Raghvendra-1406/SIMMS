from mqtt.vision_publisher import VisionPublisher


def main():

    vision_result = {
        "room_id": 1,
        "calibration_version": 1,
        "occupancy": {
            "person_count": 3
        },
        "fans": [
            {
                "device_id": 1,
                "running": False,
                "motion_score": 0.01,
                "confidence": 0.91
            }
        ]
    }

    publisher = VisionPublisher()

    try:

        publisher.connect()

        publisher.publish_vision_result(
            vision_result
        )

    finally:

        publisher.disconnect()


if __name__ == "__main__":
    main()
