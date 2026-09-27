import time

from models.camera_capture import CameraCapture
from models.person_detector import PersonDetector
from models.fan_detector import FanDetector

from mqtt.vision_publisher import VisionPublisher

from services.vision_calibration_service import (
    get_active_vision_calibration
)


class VisionRuntime:
    """
    Main vision pipeline for a single classroom.

    Responsibilities:
    - Start the Raspberry Pi camera
    - Load the active classroom calibration
    - Capture camera frames
    - Run person detection
    - Run fan detection using calibrated fan ROIs
    - Return combined vision results
    - Publish vision results through MQTT

    Does NOT:
    - Insert observations directly into PostgreSQL
    - Perform temporal fault confirmation
    - Create faults
    - Create tickets
    """

    def __init__(
        self,
        room_id,
        camera_width=1280,
        camera_height=720,
        person_model_path="yolo11n.pt",
        person_confidence=0.5,
        fan_motion_threshold=0.05
    ):
        self.room_id = room_id

        self.camera = CameraCapture(
            width=camera_width,
            height=camera_height
        )

        self.person_detector = PersonDetector(
            model_path=person_model_path,
            confidence_threshold=person_confidence
        )

        self.fan_detector = FanDetector(
            motion_threshold=fan_motion_threshold
        )

        self.calibration = None

        self.publisher = VisionPublisher()

    def load_calibration(self):
        """
        Load the active vision calibration for this classroom.

        Returns:
            Active calibration dictionary.

        Raises:
            ValueError:
                If no active calibration is available.
        """

        calibration = get_active_vision_calibration(
            self.room_id
        )

        if calibration is None:
            raise ValueError(
                f"No active vision calibration found "
                f"for room {self.room_id}."
            )

        self.calibration = calibration

        return calibration

    def start(self):
        """
        Load calibration, start the camera,
        and connect the MQTT publisher.
        """

        self.load_calibration()

        self.camera.start()

        self.publisher.connect()

        print(
            f"Vision runtime started for room "
            f"{self.room_id}."
        )

        print(
            f"Using calibration version "
            f"{self.calibration['calibration_version']}."
        )

    def process_frame(self):
        """
        Capture and process one camera frame.

        Returns:
            Combined vision result.
        """

        if self.calibration is None:
            raise RuntimeError(
                "Vision calibration has not been loaded."
            )

        frame = self.camera.read()

        person_result = self.person_detector.detect(
            frame
        )

        fan_result = self.fan_detector.detect(
            frame,
            self.calibration["calibration_data"]
        )

        return {
            "room_id": self.room_id,
            "calibration_version": (
                self.calibration["calibration_version"]
            ),
            "occupancy": {
                "person_count": (
                    person_result["person_count"]
                )
            },
            "fans": fan_result["fans"]
        }

    def run(self, interval_seconds=1.0):
        """
        Continuously process camera frames
        and publish vision results through MQTT.

        Args:
            interval_seconds:
                Time between processing cycles.
        """

        self.start()

        try:

            while True:

                result = self.process_frame()

                print(result)

                self.publisher.publish_vision_result(
                    result
                )

                time.sleep(
                    interval_seconds
                )

        except KeyboardInterrupt:

            print(
                "Stopping vision runtime..."
            )

        finally:

            self.close()

    def close(self):
        """
        Safely release camera and MQTT resources.
        """

        self.camera.close()

        self.publisher.disconnect()

        print(
            f"Vision runtime stopped for room "
            f"{self.room_id}."
        )


def run_vision_runtime(room_id):
    """
    Start the vision runtime for one classroom.
    """

    runtime = VisionRuntime(
        room_id=room_id
    )

    runtime.run()


if __name__ == "__main__":

    room_id_input = input(
        "Enter classroom room_id: "
    ).strip()

    if not room_id_input:

        print(
            "room_id is required."
        )

    else:

        try:

            room_id = int(
                room_id_input
            )

            if room_id <= 0:
                raise ValueError

            run_vision_runtime(
                room_id
            )

        except ValueError:

            print(
                "Invalid room_id. "
                "Please enter a positive integer."
            )
