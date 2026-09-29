import argparse
import time

import cv2

from models.camera_capture import CameraCapture
from models.person_detector import PersonDetector
from models.fan_detector import FanDetector
from models.board_detector import BoardDetector
from models.seat_occupancy import SeatOccupancy

from mqtt.vision_publisher import VisionPublisher

from database.repositories.room_repository import (
    get_room_by_name,
)

from services.vision_calibration_service import (
    get_active_vision_calibration
)


# Consecutive failed frame reads before the camera is reported
# OFFLINE (Plan v2 §16 T17: "within two cycles").
OFFLINE_AFTER_FAILURES = 2


class VisionRuntime:
    """
    Main vision pipeline for a single classroom.

    Runs on the Raspberry Pi, or on a laptop standing in for it
    (webcam, phone IP camera, video file or image folder).

    Responsibilities:
    - Load the active classroom calibration
    - Capture frames: two frames fan_gap_seconds apart per cycle,
      so fan rotation is measured over tens of milliseconds
      (Plan v2 §8.5)
    - Run person, seat, board and fan detection
    - Publish results and camera status through MQTT

    Does NOT:
    - Insert observations directly into PostgreSQL
    - Perform temporal fault confirmation
    - Create faults or tickets
    """

    def __init__(
        self,
        room_name,
        source="picamera",
        interval_seconds=30.0,
        fan_gap_seconds=0.15,
        camera_width=1280,
        camera_height=720,
        person_model_path="yolo11n.pt",
        person_confidence=0.5,
        fan_motion_threshold=0.05,
        show=False,
        node_id=None
    ):
        room = get_room_by_name(room_name)

        if room is None:
            raise ValueError(
                f"Room '{room_name}' not found. Room names are "
                f"case-sensitive; create it on the Classrooms page."
            )

        self.room_id = room[0]
        self.room_name = room_name

        self.interval_seconds = interval_seconds
        self.fan_gap_seconds = fan_gap_seconds
        self.show = show

        self.camera = CameraCapture(
            source=source,
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

        self.board_detector = BoardDetector()

        self.seat_occupancy = SeatOccupancy()

        self.calibration = None

        self.publisher = VisionPublisher(
            room_name=room_name,
            node_id=node_id
        )

    def load_calibration(self):
        """
        Load the active vision calibration for this classroom.

        Without a calibration only the people count is published;
        seats, board and fans need calibrated regions.
        """

        self.calibration = get_active_vision_calibration(
            self.room_id
        )

        if self.calibration is None:
            print(
                f"WARNING: no active calibration for room "
                f"{self.room_name}. Publishing people count only. "
                f"Draw board/seat/fan areas on the admin "
                f"Calibration page."
            )

        return self.calibration

    @property
    def calibration_data(self):
        if self.calibration is None:
            return {}

        return self.calibration["calibration_data"] or {}

    @property
    def calibration_version(self):
        if self.calibration is None:
            return None

        return self.calibration["calibration_version"]

    def start(self):
        self.load_calibration()

        self.camera.start()

        self.publisher.connect()

        print(
            f"Vision runtime started for room {self.room_name} "
            f"(source {self.camera.source}, every "
            f"{self.interval_seconds:g} s)."
        )

    def process_frame(self):
        """
        Capture and process one cycle.

        Returns:
            (result, frame, persons)
        """

        calibration_data = self.calibration_data

        # Frame A only seeds the fan detector's previous-frame
        # buffer; frame B is compared against it.
        first_frame = self.camera.read()

        self.fan_detector.detect(
            first_frame,
            calibration_data
        )

        time.sleep(self.fan_gap_seconds)

        frame = self.camera.read()

        started = time.monotonic()

        person_result = self.person_detector.detect(frame)

        persons = person_result["persons"]

        fan_result = self.fan_detector.detect(
            frame,
            calibration_data
        )

        occupancy = {
            "person_count": person_result["person_count"]
        }

        seats = calibration_data.get("seats") or []

        if seats:
            occupancy.update(
                self.seat_occupancy.detect(seats, persons)
            )

        board = calibration_data.get("board")

        board_result = (
            self.board_detector.detect(frame, board, persons)
            if board
            else None
        )

        result = {
            "room_id": self.room_id,
            "calibration_version": self.calibration_version,
            "occupancy": occupancy,
            "fans": fan_result["fans"],
            "board": board_result,
            "inference_ms": int((time.monotonic() - started) * 1000),
        }

        return result, frame, persons

    def draw_overlay(self, frame, result, persons):
        """
        Debug view: persons, seats, board and fans on the frame.
        """

        view = frame.copy()

        calibration_data = self.calibration_data

        seat_states = result["occupancy"].get("seat_states", {})

        for seat in calibration_data.get("seats") or []:
            occupied = seat_states.get(seat["seat_id"], False)
            color = (0, 0, 255) if occupied else (0, 200, 0)
            cv2.rectangle(view, (seat["x1"], seat["y1"]),
                          (seat["x2"], seat["y2"]), color, 1)

        board = calibration_data.get("board")

        if board and result["board"]:
            state = result["board"]["state"]
            ink = result["board"]["ink_ratio"]
            cv2.rectangle(view, (board["x1"], board["y1"]),
                          (board["x2"], board["y2"]), (255, 0, 255), 2)
            label = f"board {state}" + (
                f" {ink:.0%}" if ink is not None else ""
            )
            cv2.putText(view, label, (board["x1"], board["y1"] - 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 255), 2)

        fan_states = {
            fan["device_id"]: fan for fan in result["fans"]
        }

        for fan in calibration_data.get("fans") or []:
            state = fan_states.get(fan["device_id"], {})
            running = state.get("running")
            color = (255, 200, 0) if running else (0, 140, 255)
            cv2.rectangle(view, (fan["x1"], fan["y1"]),
                          (fan["x2"], fan["y2"]), color, 2)
            cv2.putText(
                view,
                f"fan {fan['device_id']} "
                f"{'running' if running else 'stopped'}",
                (fan["x1"], fan["y1"] - 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        for person in persons:
            x1, y1, x2, y2 = person["bbox"]
            cv2.rectangle(view, (x1, y1), (x2, y2), (0, 255, 255), 2)

        cv2.putText(
            view,
            f"{self.room_name}  people: "
            f"{result['occupancy']['person_count']}",
            (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

        return view

    def run(self, max_cycles=0):
        """
        Process and publish a cycle every interval_seconds.

        max_cycles = 0 runs until Ctrl+C (or Q in the --show window).
        """

        self.start()

        failures = 0
        cycles = 0

        try:
            while max_cycles == 0 or cycles < max_cycles:
                cycle_started = time.monotonic()
                cycles += 1

                try:
                    result, frame, persons = self.process_frame()

                except RuntimeError as exc:
                    failures += 1
                    print(f"Frame read failed ({failures}): {exc}")

                    if failures == OFFLINE_AFTER_FAILURES:
                        self.publisher.publish_status(
                            False,
                            reason="no frames from camera"
                        )
                        print("Camera reported OFFLINE.")

                    if self.camera.kind in {"webcam", "stream"}:
                        try:
                            self.camera.reopen()
                        except RuntimeError:
                            pass

                    time.sleep(self.interval_seconds)
                    continue

                failures = 0

                self.publisher.publish_vision_result(result)

                self.publisher.publish_status(
                    True,
                    source=self.camera.kind,
                    calibration_version=self.calibration_version,
                    inference_ms=result["inference_ms"],
                )

                board = result["board"]

                print(
                    f"[{cycles}] people={result['occupancy']['person_count']} "
                    f"seats={result['occupancy'].get('occupied_seats', '-')}"
                    f"/{result['occupancy'].get('total_seats', '-')} "
                    f"board={board['state'] if board else '-'} "
                    f"fans={[f['running'] for f in result['fans']]} "
                    f"({result['inference_ms']} ms)"
                )

                if self.show:
                    cv2.imshow(
                        "SIMMS vision",
                        self.draw_overlay(frame, result, persons)
                    )

                remaining = self.interval_seconds - (
                    time.monotonic() - cycle_started
                )

                if self.show:
                    # Keep the window responsive while waiting.
                    deadline = time.monotonic() + max(remaining, 0)
                    while time.monotonic() < deadline:
                        if cv2.waitKey(50) & 0xFF in (ord("q"), 27):
                            return
                elif remaining > 0:
                    time.sleep(remaining)

        except KeyboardInterrupt:
            print("Stopping vision runtime...")

        finally:
            self.close()

    def close(self):
        self.camera.close()

        self.publisher.disconnect()

        if self.show:
            cv2.destroyAllWindows()

        print(
            f"Vision runtime stopped for room "
            f"{self.room_name}."
        )


def main():
    parser = argparse.ArgumentParser(
        description=(
            "SIMMS vision runtime. On the Raspberry Pi use "
            "--source picamera; on a laptop use a webcam index, "
            "an IP camera URL, a video file or an image folder."
        )
    )
    parser.add_argument("--room-name", default="R101")
    parser.add_argument("--source", default="picamera")
    parser.add_argument("--interval", type=float, default=30.0,
                        help="seconds between cycles (Plan v2: 30-60)")
    parser.add_argument("--fan-gap", type=float, default=0.15,
                        help="seconds between the two fan frames")
    parser.add_argument("--model", default="yolo11n.pt")
    parser.add_argument("--confidence", type=float, default=0.5)
    parser.add_argument("--show", action="store_true",
                        help="debug window with detections drawn")
    parser.add_argument("--cycles", type=int, default=0,
                        help="stop after N cycles (0 = run forever)")
    parser.add_argument("--node-id",
                        help="default camera-<room>")

    args = parser.parse_args()

    VisionRuntime(
        room_name=args.room_name,
        source=args.source,
        interval_seconds=args.interval,
        fan_gap_seconds=args.fan_gap,
        person_model_path=args.model,
        person_confidence=args.confidence,
        show=args.show,
        node_id=args.node_id,
    ).run(max_cycles=args.cycles)


if __name__ == "__main__":
    main()
