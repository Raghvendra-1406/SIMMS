from database.connection import get_connection


def save_calibration_image(image_id, content_type, data, created_by):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO calibration_images (
                image_id,
                content_type,
                data,
                created_by
            )
            VALUES (%s, %s, %s, %s)
        """, (image_id, content_type, data, created_by))

        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_calibration_image(image_id):
    """
    (content_type, bytes) or None.
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT content_type, data
            FROM calibration_images
            WHERE image_id = %s
        """, (image_id,))

        row = cursor.fetchone()

        return (row[0], bytes(row[1])) if row else None

    finally:
        cursor.close()
        conn.close()
