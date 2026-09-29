class SeatOccupancy:
    """
    Maps person detections onto calibrated seat regions
    (Plan v2 §8.2).

    Each person is assigned to at most one seat:
    the seat containing the centre of the person box, or
    otherwise the seat it overlaps most (if the overlap is
    at least overlap_threshold of the seat area).

    Does NOT:
    - Run person detection
    - Publish MQTT messages
    - Access the database
    """

    def __init__(self, overlap_threshold=0.3):
        self.overlap_threshold = overlap_threshold

    def detect(self, seats, persons):
        """
        Args:
            seats:
                [{"seat_id", "x1", "y1", "x2", "y2"}]

            persons:
                [{"bbox": [x1, y1, x2, y2], ...}]

        Returns:
            {
                "total_seats": int,
                "occupied_seats": int,
                "empty_seats": int,
                "occupancy_ratio": float,
                "seat_states": {seat_id: bool}
            }
        """

        seat_states = {
            seat["seat_id"]: False
            for seat in seats
        }

        for person in persons:
            seat_id = self._assign_seat(
                seats,
                person["bbox"]
            )

            if seat_id is not None:
                seat_states[seat_id] = True

        total_seats = len(seats)
        occupied_seats = sum(seat_states.values())

        return {
            "total_seats": total_seats,
            "occupied_seats": occupied_seats,
            "empty_seats": total_seats - occupied_seats,
            "occupancy_ratio": (
                round(occupied_seats / total_seats, 4)
                if total_seats
                else 0.0
            ),
            "seat_states": seat_states
        }

    def _assign_seat(self, seats, bbox):
        px1, py1, px2, py2 = bbox

        centre_x = (px1 + px2) / 2
        centre_y = (py1 + py2) / 2

        best_seat_id = None
        best_overlap = 0.0

        for seat in seats:
            x1 = seat["x1"]
            y1 = seat["y1"]
            x2 = seat["x2"]
            y2 = seat["y2"]

            if x1 <= centre_x <= x2 and y1 <= centre_y <= y2:
                return seat["seat_id"]

            seat_area = (x2 - x1) * (y2 - y1)

            if seat_area <= 0:
                continue

            overlap_width = min(x2, px2) - max(x1, px1)
            overlap_height = min(y2, py2) - max(y1, py1)

            if overlap_width <= 0 or overlap_height <= 0:
                continue

            overlap = (overlap_width * overlap_height) / seat_area

            if overlap > best_overlap:
                best_overlap = overlap
                best_seat_id = seat["seat_id"]

        if best_overlap >= self.overlap_threshold:
            return best_seat_id

        return None
