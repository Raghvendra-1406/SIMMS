from ultralytics import YOLO


class PersonDetector:
    """
    Detects people in classroom camera frames.

    Responsibilities:
    - Load the YOLO person-detection model
    - Detect persons in a frame
    - Return person count
    - Return bounding boxes and confidence scores

    Does NOT:
    - Publish MQTT messages
    - Write to the database
    - Create tickets
    - Perform fault confirmation
    """

    PERSON_CLASS_ID = 0

    def __init__(
        self,
        model_path="yolo11n.pt",
        confidence_threshold=0.5
    ):
        self.model = YOLO(model_path)
        self.confidence_threshold = confidence_threshold

    def detect(self, frame):
        """
        Detect persons in a single image/frame.

        Args:
            frame:
                OpenCV image/frame.

        Returns:
            dict:
            {
                "person_count": int,
                "persons": [
                    {
                        "bbox": [x1, y1, x2, y2],
                        "confidence": float
                    }
                ]
            }
        """

        results = self.model(
            frame,
            conf=self.confidence_threshold,
            verbose=False
        )

        persons = []

        for result in results:

            if result.boxes is None:
                continue

            for box in result.boxes:

                class_id = int(box.cls[0])
                confidence = float(box.conf[0])

                # COCO class 0 = person
                if class_id != self.PERSON_CLASS_ID:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].tolist()

                persons.append({
                    "bbox": [
                        int(x1),
                        int(y1),
                        int(x2),
                        int(y2)
                    ],
                    "confidence": confidence
                })

        return {
            "person_count": len(persons),
            "persons": persons
        }