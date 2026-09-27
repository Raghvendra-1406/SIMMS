import cv2
import json
import os


class FanCalibrationTool:
    """
    Interactive OpenCV tool for calibrating fan regions.

    The Admin:
    1. Opens a classroom reference image.
    2. Draws a rectangle around each fan.
    3. Enters the corresponding fan device ID.
    4. Saves the calibration data.

    The tool does not access PostgreSQL or create tickets.
    It only produces calibration data that can be sent to
    the SIMMS calibration API.
    """

    WINDOW_NAME = "SIMMS - Fan Calibration"

    def __init__(self, image_path):
        self.image_path = image_path

        self.image = cv2.imread(image_path)

        if self.image is None:
            raise ValueError(
                f"Unable to load image: {image_path}"
            )

        self.display_image = self.image.copy()

        self.drawing = False

        self.start_x = 0
        self.start_y = 0

        self.current_x = 0
        self.current_y = 0

        self.calibrations = []

    def mouse_callback(self, event, x, y, flags, param):
        """
        Handles mouse actions used to draw fan rectangles.
        """

        if event == cv2.EVENT_LBUTTONDOWN:

            self.drawing = True

            self.start_x = x
            self.start_y = y

            self.current_x = x
            self.current_y = y

        elif event == cv2.EVENT_MOUSEMOVE:

            if self.drawing:

                self.current_x = x
                self.current_y = y

                self.display_image = self.image.copy()

                self._draw_saved_rectangles()

                cv2.rectangle(
                    self.display_image,
                    (self.start_x, self.start_y),
                    (self.current_x, self.current_y),
                    (0, 255, 0),
                    2
                )

        elif event == cv2.EVENT_LBUTTONUP:

            self.drawing = False

            self.current_x = x
            self.current_y = y

            x1 = min(self.start_x, self.current_x)
            y1 = min(self.start_y, self.current_y)

            x2 = max(self.start_x, self.current_x)
            y2 = max(self.start_y, self.current_y)

            # Ignore extremely small accidental selections.
            if (x2 - x1) < 10 or (y2 - y1) < 10:
                self.display_image = self.image.copy()
                self._draw_saved_rectangles()
                return

            device_id = self._get_device_id()

            if device_id is None:
                self.display_image = self.image.copy()
                self._draw_saved_rectangles()
                return

            calibration = {
                "device_id": device_id,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2
            }

            self.calibrations.append(calibration)

            print(
                f"Fan {device_id} calibrated: "
                f"({x1}, {y1}) -> ({x2}, {y2})"
            )

            self.display_image = self.image.copy()

            self._draw_saved_rectangles()

    def _get_device_id(self):
        """
        Ask the Admin for the device ID associated with
        the rectangle just drawn.
        """

        while True:

            value = input(
                "Enter fan device ID "
                "(press Enter to cancel): "
            ).strip()

            if value == "":
                return None

            try:
                device_id = int(value)

                if device_id <= 0:
                    print("Device ID must be greater than 0.")
                    continue

                return device_id

            except ValueError:
                print(
                    "Invalid device ID. "
                    "Please enter a number."
                )

    def _draw_saved_rectangles(self):
        """
        Draw all previously saved fan rectangles.
        """

        for index, fan in enumerate(self.calibrations, start=1):

            x1 = fan["x1"]
            y1 = fan["y1"]
            x2 = fan["x2"]
            y2 = fan["y2"]

            cv2.rectangle(
                self.display_image,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            label = (
                f"Fan {fan['device_id']}"
            )

            cv2.putText(
                self.display_image,
                label,
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )

    def save_calibration(self):
        """
        Save calibration data as JSON.

        This JSON can later be sent to the SIMMS
        /vision/calibration API.
        """

        output = {
            "fans": self.calibrations
        }

        output_path = os.path.splitext(
            self.image_path
        )[0] + "_fan_calibration.json"

        with open(
            output_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                output,
                file,
                indent=4
            )

        print()
        print(
            "Calibration saved successfully."
        )
        print(
            f"File: {output_path}"
        )

        return output

    def run(self):
        """
        Start the interactive calibration tool.
        """

        cv2.namedWindow(
            self.WINDOW_NAME,
            cv2.WINDOW_NORMAL
        )

        cv2.setMouseCallback(
            self.WINDOW_NAME,
            self.mouse_callback
        )

        self.display_image = self.image.copy()

        print()
        print("====================================")
        print(" SIMMS FAN CALIBRATION")
        print("====================================")
        print()
        print("Draw a rectangle around each fan.")
        print()
        print("Controls:")
        print("  Mouse drag  -> Draw fan ROI")
        print("  S           -> Save calibration")
        print("  R           -> Reset all rectangles")
        print("  U           -> Remove last rectangle")
        print("  Q / ESC     -> Exit")
        print()

        while True:

            cv2.imshow(
                self.WINDOW_NAME,
                self.display_image
            )

            key = cv2.waitKey(1) & 0xFF

            if key == ord("s"):

                if not self.calibrations:
                    print(
                        "No fan rectangles have been added."
                    )
                    continue

                self.save_calibration()

            elif key == ord("r"):

                self.calibrations.clear()

                self.display_image = self.image.copy()

                print(
                    "All fan rectangles cleared."
                )

            elif key == ord("u"):

                if self.calibrations:

                    removed = self.calibrations.pop()

                    print(
                        f"Removed Fan "
                        f"{removed['device_id']}."
                    )

                    self.display_image = self.image.copy()

                    self._draw_saved_rectangles()

                else:

                    print(
                        "No rectangle to remove."
                    )

            elif key == ord("q") or key == 27:

                break

        cv2.destroyAllWindows()


def calibrate_fans(image_path):
    """
    Convenience function for starting fan calibration.
    """

    tool = FanCalibrationTool(
        image_path
    )

    tool.run()


if __name__ == "__main__":

    image_path = input(
        "Enter classroom image path: "
    ).strip()

    if not image_path:
        print(
            "Image path is required."
        )

    elif not os.path.exists(image_path):

        print(
            f"Image not found: {image_path}"
        )

    else:

        calibrate_fans(
            image_path
        )