import cv2


class LightDetector:
    """
    Decides whether each calibrated tube light is lit.

    Classical image processing (like the board check): the mean
    brightness (HSV value channel) inside each tube's region,
    compared with a threshold. A lit tube is close to saturated white
    in the image; an unlit tube is as dark as the ceiling around it.

    The circuit current says how many tubes are powered; this says
    which ones actually light up, so a powered-but-dark tube can be
    pinpointed (backend services.unit_service).

    Does NOT:
    - Decide faults (needs the circuit current; the backend does it)
    - Publish MQTT messages
    - Access the database
    """

    def __init__(self, brightness_threshold=0.60):
        self.brightness_threshold = brightness_threshold

    def detect(self, frame, calibration_data):
        """
        Args:
            frame: OpenCV BGR frame.
            calibration_data: {"lights": [{"device_id", "x1", "y1",
                "x2", "y2", "threshold" (optional)}]}

        Returns:
            {"lights": [{"device_id", "lit", "brightness",
                         "confidence"}]}
            confidence == 0 means the region could not be measured.
        """

        if frame is None:
            raise ValueError("Camera frame is empty.")

        height, width = frame.shape[:2]

        observations = []

        for light in (calibration_data or {}).get("lights") or []:
            x1 = max(0, min(int(light["x1"]), width))
            x2 = max(0, min(int(light["x2"]), width))
            y1 = max(0, min(int(light["y1"]), height))
            y2 = max(0, min(int(light["y2"]), height))

            if x2 <= x1 or y2 <= y1:
                observations.append({
                    "device_id": light["device_id"],
                    "lit": False,
                    "brightness": 0.0,
                    "confidence": 0.0,
                })
                continue

            roi = frame[y1:y2, x1:x2]

            value = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)[:, :, 2]

            brightness = float(value.mean()) / 255.0

            threshold = float(
                light.get("threshold") or self.brightness_threshold
            )

            observations.append({
                "device_id": light["device_id"],
                "lit": brightness >= threshold,
                "brightness": round(brightness, 3),
                # Lowest at the threshold; 1.0 about 0.2 away from it.
                "confidence": round(
                    min(1.0, 0.5 + abs(brightness - threshold) * 2.5),
                    3
                ),
            })

        return {"lights": observations}
