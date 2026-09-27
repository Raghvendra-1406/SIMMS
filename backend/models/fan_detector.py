import cv2


class FanDetector:
    """
    Detects whether calibrated fans are running or stopped.

    The fan locations are provided through calibration data.
    Motion inside each fan ROI is used to estimate fan movement.

    Responsibilities:
    - Read calibrated fan coordinates
    - Extract fan regions from camera frames
    - Calculate motion inside each fan region
    - Return fan running/stopped observations

    Does NOT:
    - Perform temporal fault confirmation
    - Create faults or tickets
    - Publish MQTT messages
    - Access the database
    """

    def __init__(
        self,
        motion_threshold=0.05,
        min_confidence=0.5
    ):
        self.motion_threshold = motion_threshold
        self.min_confidence = min_confidence

        self.previous_frames = {}

    def detect(self, frame, calibration_data):
        """
        Detect fan movement for all calibrated fans.

        Args:
            frame:
                Current OpenCV camera frame.

            calibration_data:
                Dictionary containing calibrated fan ROIs.

                Example:
                {
                    "fans": [
                        {
                            "device_id": 10,
                            "x1": 120,
                            "y1": 80,
                            "x2": 260,
                            "y2": 220
                        },
                        {
                            "device_id": 11,
                            "x1": 700,
                            "y1": 100,
                            "x2": 840,
                            "y2": 240
                        }
                    ]
                }

        Returns:
            Dictionary containing fan observations.
        """

        if frame is None:
            raise ValueError("Camera frame is empty.")

        if not calibration_data:
            return {
                "fans": []
            }

        fan_calibrations = calibration_data.get("fans", [])

        observations = []

        for fan in fan_calibrations:

            device_id = fan["device_id"]

            x1 = int(fan["x1"])
            y1 = int(fan["y1"])
            x2 = int(fan["x2"])
            y2 = int(fan["y2"])

            # Make sure coordinates are inside the frame.
            height, width = frame.shape[:2]

            x1 = max(0, min(x1, width))
            x2 = max(0, min(x2, width))

            y1 = max(0, min(y1, height))
            y2 = max(0, min(y2, height))

            # Invalid ROI
            if x2 <= x1 or y2 <= y1:
                observations.append({
                    "device_id": device_id,
                    "running": False,
                    "motion_score": 0.0,
                    "confidence": 0.0
                })
                continue

            roi = frame[y1:y2, x1:x2]

            motion_score = self._calculate_motion(
                device_id,
                roi
            )

            # The first frame cannot establish movement.
            if motion_score is None:
                observations.append({
                    "device_id": device_id,
                    "running": False,
                    "motion_score": 0.0,
                    "confidence": 0.0
                })
                continue

            running = motion_score >= self.motion_threshold

            confidence = self._calculate_confidence(
                motion_score
            )

            observations.append({
                "device_id": device_id,
                "running": running,
                "motion_score": round(motion_score, 4),
                "confidence": round(confidence, 4)
            })

        return {
            "fans": observations
        }

    def _calculate_motion(self, device_id, roi):
        """
        Calculate motion between the current ROI and the
        previous ROI for the same fan.

        Returns:
            Motion score between 0 and 1.

            None is returned when there is no previous frame.
        """

        gray = cv2.cvtColor(
            roi,
            cv2.COLOR_BGR2GRAY
        )

        gray = cv2.GaussianBlur(
            gray,
            (5, 5),
            0
        )

        previous = self.previous_frames.get(device_id)

        self.previous_frames[device_id] = gray

        if previous is None:
            return None

        # Ensure both frames have the same dimensions.
        if previous.shape != gray.shape:
            return None

        difference = cv2.absdiff(
            previous,
            gray
        )

        # Remove very small pixel-level noise.
        _, thresholded = cv2.threshold(
            difference,
            20,
            255,
            cv2.THRESH_BINARY
        )

        changed_pixels = cv2.countNonZero(
            thresholded
        )

        total_pixels = thresholded.shape[0] * thresholded.shape[1]

        if total_pixels == 0:
            return 0.0

        motion_score = changed_pixels / total_pixels

        return min(motion_score, 1.0)

    def _calculate_confidence(self, motion_score):
        """
        Convert motion strength into a simple confidence value.

        Confidence is highest when the motion is clearly above
        or below the running threshold.
        """

        if motion_score <= 0:
            return 1.0

        distance = abs(
            motion_score - self.motion_threshold
        )

        confidence = min(
            1.0,
            0.5 + distance * 5
        )

        return max(
            self.min_confidence,
            confidence
        )