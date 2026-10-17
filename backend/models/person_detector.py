from pathlib import Path

import cv2
import numpy as np


# YOLO11n exported to ONNX (models/weights/yolo11n.onnx, ~11 MB).
# Runs with onnxruntime + OpenCV only, so the Raspberry Pi does not
# need PyTorch / ultralytics / NVIDIA libraries (~3-4 GB). Exported
# with a dynamic input size so frames are sized exactly as ultralytics
# sizes them; re-export on a laptop with:
#     yolo export model=yolo11n.pt format=onnx imgsz=640 opset=12 simplify=True dynamic=True
DEFAULT_ONNX_MODEL = Path(__file__).resolve().parent / "weights" / "yolo11n.onnx"


def default_model_path():
    """
    The ONNX model when onnxruntime is installed (Pi and laptop),
    otherwise the ultralytics .pt model.
    """

    try:
        import onnxruntime  # noqa: F401
    except ImportError:
        return "yolo11n.pt"

    if DEFAULT_ONNX_MODEL.exists():
        return str(DEFAULT_ONNX_MODEL)

    return "yolo11n.pt"


class PersonDetector:
    """
    Detects people in classroom camera frames.

    Responsibilities:
    - Load the YOLO person-detection model
    - Detect persons in a frame
    - Return person count
    - Return bounding boxes and confidence scores

    Two backends, same model and output:
    - .onnx : onnxruntime (lightweight; used on the Raspberry Pi)
    - .pt   : ultralytics / PyTorch

    Does NOT:
    - Publish MQTT messages
    - Write to the database
    - Create tickets
    - Perform fault confirmation
    """

    PERSON_CLASS_ID = 0

    # Same non-maximum suppression threshold as ultralytics' default.
    IOU_THRESHOLD = 0.7

    # ultralytics defaults: long side 640, padding to a multiple of 32.
    IMAGE_SIZE = 640
    STRIDE = 32

    def __init__(
        self,
        model_path=None,
        confidence_threshold=0.5
    ):
        self.model_path = str(model_path or default_model_path())
        self.confidence_threshold = confidence_threshold

        if self.model_path.lower().endswith(".onnx"):
            self._load_onnx()
            self.backend = "onnx"
        else:
            from ultralytics import YOLO

            self.model = YOLO(self.model_path)
            self.backend = "ultralytics"

    # ---------------------------------------------------------
    # ONNX backend
    # ---------------------------------------------------------

    def _load_onnx(self):
        import onnxruntime as ort

        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self.session = ort.InferenceSession(
            self.model_path,
            sess_options=options,
            providers=["CPUExecutionProvider"]
        )

        model_input = self.session.get_inputs()[0]
        self.input_name = model_input.name

        # [1, 3, H, W]: names ("height") when exported dynamic=True,
        # numbers for a fixed-size export.
        height, width = model_input.shape[2], model_input.shape[3]
        self.dynamic_input = not (isinstance(height, int) and isinstance(width, int))
        self.input_height = self.IMAGE_SIZE if self.dynamic_input else height
        self.input_width = self.IMAGE_SIZE if self.dynamic_input else width

    def _letterbox(self, frame):
        """
        Resize keeping the aspect ratio and pad, exactly as ultralytics
        does (grey 114 padding, centred). With a dynamic model the
        padding only reaches the next multiple of 32 (a 16:9 frame
        becomes 384x640), like ultralytics' rectangular inference.
        """

        height, width = frame.shape[:2]
        scale = min(self.input_width / width, self.input_height / height)

        new_width = int(round(width * scale))
        new_height = int(round(height * scale))

        resized = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_LINEAR)

        pad_x = self.input_width - new_width
        pad_y = self.input_height - new_height

        if self.dynamic_input:
            pad_x %= self.STRIDE
            pad_y %= self.STRIDE

        pad_x /= 2
        pad_y /= 2

        top, bottom = int(round(pad_y - 0.1)), int(round(pad_y + 0.1))
        left, right = int(round(pad_x - 0.1)), int(round(pad_x + 0.1))

        padded = cv2.copyMakeBorder(
            resized, top, bottom, left, right,
            cv2.BORDER_CONSTANT, value=(114, 114, 114)
        )

        return padded, scale, left, top

    def _detect_onnx(self, frame):
        image, scale, pad_left, pad_top = self._letterbox(frame)

        # BGR uint8 HWC -> RGB float32 NCHW in [0, 1]
        blob = cv2.dnn.blobFromImage(image, 1 / 255.0, swapRB=True)

        # [1, 4 + classes, anchors] -> [anchors, 4 + classes]
        output = self.session.run(None, {self.input_name: blob})[0][0].T

        person_scores = output[:, 4 + self.PERSON_CLASS_ID]
        keep = person_scores >= self.confidence_threshold

        if not np.any(keep):
            return []

        candidates = output[keep, :4]
        scores = person_scores[keep]

        # centre x, centre y, width, height (model space) -> original image
        x = (candidates[:, 0] - candidates[:, 2] / 2 - pad_left) / scale
        y = (candidates[:, 1] - candidates[:, 3] / 2 - pad_top) / scale
        w = candidates[:, 2] / scale
        h = candidates[:, 3] / scale

        boxes = np.stack([x, y, w, h], axis=1)

        indices = cv2.dnn.NMSBoxes(
            boxes.tolist(),
            scores.tolist(),
            self.confidence_threshold,
            self.IOU_THRESHOLD
        )

        frame_height, frame_width = frame.shape[:2]
        persons = []

        for index in np.array(indices).flatten():
            bx, by, bw, bh = boxes[index]

            persons.append({
                "bbox": [
                    int(max(0, bx)),
                    int(max(0, by)),
                    int(min(frame_width, bx + bw)),
                    int(min(frame_height, by + bh))
                ],
                "confidence": float(scores[index])
            })

        persons.sort(key=lambda person: -person["confidence"])

        return persons

    # ---------------------------------------------------------
    # ultralytics backend
    # ---------------------------------------------------------

    def _detect_ultralytics(self, frame):
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

        return persons

    def detect(self, frame):
        """
        Detect persons in a single image/frame.

        Args:
            frame:
                OpenCV image/frame (BGR).

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

        if self.backend == "onnx":
            persons = self._detect_onnx(frame)
        else:
            persons = self._detect_ultralytics(frame)

        return {
            "person_count": len(persons),
            "persons": persons
        }
