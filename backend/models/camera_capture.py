import argparse
import os
import time

import cv2


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}


class CameraCapture:
    """
    Frame source for the vision runtime.

    The same runtime runs on the Raspberry Pi and on a laptop that
    stands in for it; only the source differs:

        "picamera"                   Raspberry Pi Camera Module (picamera2)
        "0", "1", ...                USB / laptop webcam index
        "http://..." / "rtsp://..."  IP camera, e.g. the phone app
                                     "IP Webcam": http://<phone-ip>:8080/video
        path/to/video.mp4            video file, looped
        path/to/folder               folder of images, cycled in name order
                                     (repeatable dry runs)
        path/to/image.jpg            single still image

    Responsibilities:
    - Open the source and return OpenCV BGR frames

    Does NOT:
    - Perform detection
    - Publish MQTT messages
    - Access the database
    """

    def __init__(
        self,
        source="picamera",
        width=1280,
        height=720
    ):
        self.source = str(source)
        self.width = width
        self.height = height

        self.kind = self._detect_kind(self.source)

        self._camera = None
        self._images = []
        self._image_index = 0

        self.started = False

    @staticmethod
    def _detect_kind(source):
        if source == "picamera":
            return "picamera"

        if source.isdigit():
            return "webcam"

        if source.startswith(("http://", "https://", "rtsp://")):
            return "stream"

        if os.path.isdir(source):
            return "folder"

        if os.path.isfile(source):
            extension = os.path.splitext(source)[1].lower()
            return "image" if extension in IMAGE_EXTENSIONS else "video"

        raise ValueError(
            f"Unknown camera source '{source}'. Use picamera, a webcam "
            f"index, a stream URL, a video/image file or a folder."
        )

    def start(self):
        if self.started:
            return

        if self.kind == "picamera":
            # Imported here so the module also works off the Pi.
            from picamera2 import Picamera2

            self._camera = Picamera2()
            self._camera.configure(
                self._camera.create_preview_configuration(
                    main={
                        "size": (self.width, self.height),
                        "format": "BGR888"
                    }
                )
            )
            self._camera.start()

        elif self.kind in {"webcam", "stream", "video"}:
            target = (
                int(self.source)
                if self.kind == "webcam"
                else self.source
            )

            self._camera = cv2.VideoCapture(target)

            if self.kind == "webcam":
                self._camera.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                self._camera.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)

            if not self._camera.isOpened():
                raise RuntimeError(
                    f"Could not open camera source '{self.source}'."
                )

        elif self.kind == "folder":
            self._images = sorted(
                os.path.join(self.source, name)
                for name in os.listdir(self.source)
                if os.path.splitext(name)[1].lower() in IMAGE_EXTENSIONS
            )

            if not self._images:
                raise RuntimeError(
                    f"No images found in folder '{self.source}'."
                )

        elif self.kind == "image":
            self._images = [self.source]

        self.started = True

    def read(self):
        """
        Capture one frame.

        Returns:
            OpenCV BGR frame.

        Raises:
            RuntimeError: no frame could be read (camera offline).
        """

        if not self.started:
            raise RuntimeError(
                "Camera has not been started. "
                "Call start() before read()."
            )

        if self.kind == "picamera":
            return self._camera.capture_array()

        if self.kind in {"folder", "image"}:
            path = self._images[self._image_index]
            self._image_index = (self._image_index + 1) % len(self._images)

            frame = cv2.imread(path)

            if frame is None:
                raise RuntimeError(f"Could not read image '{path}'.")

            return frame

        ok, frame = self._camera.read()

        if not ok and self.kind == "video":
            # Loop the video file.
            self._camera.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame = self._camera.read()

        if not ok or frame is None:
            raise RuntimeError(
                f"No frame from camera source '{self.source}'."
            )

        return frame

    def reopen(self):
        """
        Try to reconnect a webcam / stream after read failures.
        """

        self.close()
        self.start()

    def stop(self):
        if not self.started:
            return

        if self.kind == "picamera":
            self._camera.stop()

        self.started = False

    def close(self):
        self.stop()

        if self._camera is not None:
            if self.kind == "picamera":
                self._camera.close()
            else:
                self._camera.release()

            self._camera = None

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


def capture_camera_preview(source):
    """
    Live preview of a camera source. Press S to save a snapshot,
    Q or ESC to exit.
    """

    with CameraCapture(source) as camera:
        print("Camera started. S = save snapshot, Q / ESC = exit.")

        while True:
            frame = camera.read()

            cv2.imshow("SIMMS Camera Preview", frame)

            key = cv2.waitKey(30) & 0xFF

            if key == ord("s"):
                name = f"snapshot_{int(time.time())}.jpg"
                cv2.imwrite(name, frame)
                print(f"Saved {name}")

            if key in (ord("q"), 27):
                break

    cv2.destroyAllWindows()


def save_snapshot(source, output_path):
    """
    Save one frame, e.g. the reference image for the admin
    Calibration page.
    """

    with CameraCapture(source) as camera:
        # Webcams often return a dark first frame while exposure settles.
        frame = None
        for _ in range(5 if camera.kind in {"webcam", "stream"} else 1):
            frame = camera.read()

        cv2.imwrite(output_path, frame)

    print(f"Saved {output_path} ({frame.shape[1]}x{frame.shape[0]}).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Preview a camera source or save a snapshot."
    )
    parser.add_argument("--source", default="0",
                        help="picamera, webcam index, URL, video, image or folder")
    parser.add_argument("--snapshot", metavar="OUT.jpg",
                        help="save one frame and exit")

    args = parser.parse_args()

    if args.snapshot:
        save_snapshot(args.source, args.snapshot)
    else:
        capture_camera_preview(args.source)
