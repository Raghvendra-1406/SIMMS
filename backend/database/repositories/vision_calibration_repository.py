from psycopg2.extras import Json

from database.connection import get_connection


def create_calibration(
    room_id,
    calibration_version,
    image_path,
    calibration_data,
    created_by
):
    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            INSERT INTO vision_calibrations (
                room_id,
                calibration_version,
                image_path,
                calibration_data,
                created_by
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING calibration_id;
        """

        cursor.execute(
            query,
            (
                room_id,
                calibration_version,
                image_path,
                Json(calibration_data),
                created_by
            )
        )

        calibration_id = cursor.fetchone()[0]

        conn.commit()

        return calibration_id

    finally:
        cursor.close()
        conn.close()

def room_exists(room_id):
    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT 1
            FROM rooms
            WHERE room_id = %s;
            """,
            (room_id,)
        )

        return cursor.fetchone() is not None

    finally:
        cursor.close()
        conn.close()


def device_belongs_to_room(device_id, room_id):
    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT 1
            FROM devices
            WHERE device_id = %s
              AND room_id = %s
              AND status = 'ACTIVE';
            """,
            (device_id, room_id)
        )

        return cursor.fetchone() is not None

    finally:
        cursor.close()
        conn.close()


def calibration_version_exists(room_id, calibration_version):
    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT 1
            FROM vision_calibrations
            WHERE room_id = %s
              AND calibration_version = %s;
            """,
            (room_id, calibration_version)
        )

        return cursor.fetchone() is not None

    finally:
        cursor.close()
        conn.close()


def get_next_calibration_version(room_id):
    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT COALESCE(
                MAX(calibration_version),
                0
            ) + 1
            FROM vision_calibrations
            WHERE room_id = %s;
            """,
            (room_id,)
        )

        return cursor.fetchone()[0]

    finally:
        cursor.close()
        conn.close()


def deactivate_room_calibrations(room_id):
    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE vision_calibrations
            SET is_active = FALSE
            WHERE room_id = %s
              AND is_active = TRUE;
            """,
            (room_id,)
        )

        conn.commit()

    finally:
        cursor.close()
        conn.close()

def get_active_calibration(room_id):
    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                calibration_id,
                room_id,
                calibration_version,
                image_path,
                calibration_data,
                created_by,
                created_at,
                is_active
            FROM vision_calibrations
            WHERE room_id = %s
              AND is_active = TRUE
            ORDER BY calibration_version DESC
            LIMIT 1;
            """,
            (room_id,)
        )

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()