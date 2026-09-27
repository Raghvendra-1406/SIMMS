from picamera2 import Picamera2
import cv2


class CameraCapture:
    """
    Handles image capture from the Raspberry Pi Camera Module.

    Responsibilities:
    - Initialize Raspberry Pi Camera Module
    - Capture OpenCV-compatible frames
    - Release the camera safely

    Does NOT:
    - Perform object detection
    - Perform fan detection
    - Publish MQTT messages
    - Access the database
    - Create faults or tickets
    """

    def __init__(
        self,
        width=1280,
        height=720
    ):
        self.width = width
        self.height = height

        self.camera = Picamera2()

        self.camera_config = self.camera.create_preview_configuration(
            main={
                "size": (
                    self.width,
                    self.height
                ),
                "format": "BGR888"
            }
        )

        self.camera.configure(
            self.camera_config
        )

        self.started = False

    def start(self):
        """
        Start the Raspberry Pi Camera Module.
        """

        if self.started:
            return

        self.camera.start()

        self.started = True

    def read(self):
        """
        Capture one frame from the camera.

        Returns:
            OpenCV BGR frame.
        """

        if not self.started:
            raise RuntimeError(
                "Camera has not been started. "
                "Call start() before read()."
            )

        frame = self.camera.capture_array()

        return frame

    def stop(self):
        """
        Stop the camera safely.
        """

        if not self.started:
            return

        self.camera.stop()

        self.started = False

    def close(self):
        """
        Release the camera resources.
        """

        self.stop()

        self.camera.close()

    def __enter__(self):
        self.start()
        return self

    def __exit__(
        self,
        exc_type,
        exc_value,
        traceback
    ):
        self.close()


def capture_camera_preview():
    """
    Simple manual camera test.

    Opens the Raspberry Pi Camera Module and displays
    the live camera feed.

    Press Q or ESC to exit.
    """

    camera = CameraCapture()

    try:
        camera.start()

        print("Raspberry Pi Camera started.")
        print("Press Q or ESC to exit.")

        while True:

            frame = camera.read()

            cv2.imshow(
                "SIMMS Camera Preview",
                frame
            )

            key = cv2.waitKey(1) & 0xFF

            if key == ord("q") or key == 27:
                break

    finally:

        camera.close()

        cv2.destroyAllWindows()


if __name__ == "__main__":
    capture_camera_preview()