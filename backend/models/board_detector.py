import cv2


class BoardDetector:
    """
    Measures how much of the classroom board is written on.

    Classical image processing only (Plan v2 §8.3):
    board ROI -> greyscale -> adaptive threshold ->
    morphological opening -> ink ratio.

    Responsibilities:
    - Crop the calibrated board region
    - Skip the frame when a person is standing in front of the board
    - Calculate the ink ratio and classify the board state

    Does NOT:
    - Decide whether the board needs cleaning
      (that also needs occupancy history; the backend does it)
    - Publish MQTT messages
    - Access the database
    """

    # Ink ratio thresholds (Plan v2 §8.3).
    CLEAN_MAX = 0.05
    IN_USE_MAX = 0.25

    # The board ROI is resized to this width so the
    # threshold block size means the same on every camera.
    PROCESS_WIDTH = 640

    def __init__(
        self,
        block_size=31,
        threshold_offset=10,
        occlusion_threshold=0.10
    ):
        self.block_size = block_size
        self.threshold_offset = threshold_offset

        # Fraction of the board covered by a person box
        # above which the frame is not measured.
        self.occlusion_threshold = occlusion_threshold

    def detect(self, frame, board, persons=None):
        """
        Measure the board in one frame.

        Args:
            frame:
                OpenCV BGR frame.

            board:
                Board calibration:
                {"x1", "y1", "x2", "y2", "board_type"}
                board_type is WHITEBOARD (dark ink on a light
                surface) or BLACKBOARD (light chalk on a dark one).

            persons:
                Person detections from PersonDetector:
                [{"bbox": [x1, y1, x2, y2], ...}]

        Returns:
            {
                "state": "CLEAN" | "IN_USE" | "DIRTY" | "OCCLUDED",
                "ink_ratio": float | None,
                "confidence": float
            }

            confidence == 0 means the frame could not be measured.
        """

        if frame is None:
            raise ValueError("Camera frame is empty.")

        height, width = frame.shape[:2]

        x1 = max(0, min(int(board["x1"]), width))
        x2 = max(0, min(int(board["x2"]), width))
        y1 = max(0, min(int(board["y1"]), height))
        y2 = max(0, min(int(board["y2"]), height))

        if x2 <= x1 or y2 <= y1:
            return {
                "state": None,
                "ink_ratio": None,
                "confidence": 0.0
            }

        # A lecturer at the board would be counted as writing.
        if self._is_occluded((x1, y1, x2, y2), persons or []):
            return {
                "state": "OCCLUDED",
                "ink_ratio": None,
                "confidence": 0.0
            }

        roi = frame[y1:y2, x1:x2]

        ink_ratio = self._calculate_ink_ratio(
            roi,
            board.get("board_type", "WHITEBOARD")
        )

        return {
            "state": self._classify(ink_ratio),
            "ink_ratio": round(ink_ratio, 4),
            "confidence": round(
                self._calculate_confidence(ink_ratio),
                4
            )
        }

    def _is_occluded(self, board_box, persons):
        bx1, by1, bx2, by2 = board_box

        board_area = (bx2 - bx1) * (by2 - by1)

        for person in persons:
            px1, py1, px2, py2 = person["bbox"]

            overlap_width = min(bx2, px2) - max(bx1, px1)
            overlap_height = min(by2, py2) - max(by1, py1)

            if overlap_width <= 0 or overlap_height <= 0:
                continue

            overlap = overlap_width * overlap_height

            if overlap / board_area > self.occlusion_threshold:
                return True

        return False

    def _calculate_ink_ratio(self, roi, board_type):
        roi_height, roi_width = roi.shape[:2]

        scale = self.PROCESS_WIDTH / roi_width

        roi = cv2.resize(
            roi,
            (
                self.PROCESS_WIDTH,
                max(1, int(roi_height * scale))
            )
        )

        gray = cv2.cvtColor(
            roi,
            cv2.COLOR_BGR2GRAY
        )

        gray = cv2.GaussianBlur(
            gray,
            (3, 3),
            0
        )

        # A pixel is ink when it differs from its local mean
        # by more than threshold_offset. The local mean makes
        # this robust to uneven lighting and glare.
        if board_type == "BLACKBOARD":
            marked = cv2.adaptiveThreshold(
                gray,
                255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY,
                self.block_size,
                -self.threshold_offset
            )

        else:
            marked = cv2.adaptiveThreshold(
                gray,
                255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY_INV,
                self.block_size,
                self.threshold_offset
            )

        # Remove speckle noise.
        kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (3, 3)
        )

        marked = cv2.morphologyEx(
            marked,
            cv2.MORPH_OPEN,
            kernel
        )

        total_pixels = marked.shape[0] * marked.shape[1]

        if total_pixels == 0:
            return 0.0

        return cv2.countNonZero(marked) / total_pixels

    def _classify(self, ink_ratio):
        if ink_ratio < self.CLEAN_MAX:
            return "CLEAN"

        if ink_ratio <= self.IN_USE_MAX:
            return "IN_USE"

        return "DIRTY"

    def _calculate_confidence(self, ink_ratio):
        """
        Confidence is lowest next to a state boundary and
        reaches 1.0 about 5 percentage points away from it.
        """

        distance = min(
            abs(ink_ratio - self.CLEAN_MAX),
            abs(ink_ratio - self.IN_USE_MAX)
        )

        return min(
            1.0,
            0.5 + distance * 10
        )
