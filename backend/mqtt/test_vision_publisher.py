"""
Publish one sample vision result for room R101.

    cd backend
    python -m mqtt.test_vision_publisher

For a continuous stand-in node use scripts/fake_node.py instead.
"""

from mqtt.vision_publisher import VisionPublisher


def main():

    vision_result = {
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
        ],
        "board": {
            "state": "CLEAN",
            "ink_ratio": 0.01,
            "confidence": 1.0
        }
    }

    publisher = VisionPublisher(room_name="R101")

    try:

        publisher.connect()

        publisher.publish_status(True)

        publisher.publish_vision_result(
            vision_result
        )

    finally:

        publisher.disconnect()


if __name__ == "__main__":
    main()
