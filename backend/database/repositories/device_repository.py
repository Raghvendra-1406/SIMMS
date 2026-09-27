from database.connection import get_connection


def get_all_devices():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                device_id,
                room_id,
                device_type,
                device_name,
                status,
                last_seen,
                created_at
            FROM devices
            ORDER BY device_id
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_device_by_id(device_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                device_id,
                room_id,
                device_type,
                device_name,
                status,
                last_seen,
                created_at
            FROM devices
            WHERE device_id = %s
        """, (device_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_devices_by_room(room_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                device_id,
                room_id,
                device_type,
                device_name,
                status,
                last_seen,
                created_at
            FROM devices
            WHERE room_id = %s
            ORDER BY device_id
        """, (room_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def create_device(
    room_id,
    device_type,
    device_name,
    status="ACTIVE"
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO devices (
                room_id,
                device_type,
                device_name,
                status
            )
            VALUES (%s, %s, %s, %s)
            RETURNING
                device_id,
                room_id,
                device_type,
                device_name,
                status,
                last_seen,
                created_at
        """, (
            room_id,
            device_type,
            device_name,
            status
        ))

        device = cursor.fetchone()
        conn.commit()

        return device

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def update_device(
    device_id,
    room_id,
    device_type,
    device_name,
    status="ACTIVE"
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE devices
            SET
                room_id = %s,
                device_type = %s,
                device_name = %s,
                status = %s
            WHERE device_id = %s
            RETURNING
                device_id,
                room_id,
                device_type,
                device_name,
                status,
                last_seen,
                created_at
        """, (
            room_id,
            device_type,
            device_name,
            status,
            device_id
        ))

        device = cursor.fetchone()
        conn.commit()

        return device

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def update_device_last_seen(device_id, last_seen):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE devices
            SET last_seen = %s
            WHERE device_id = %s
            RETURNING
                device_id,
                room_id,
                device_type,
                device_name,
                status,
                last_seen,
                created_at
        """, (
            last_seen,
            device_id
        ))

        device = cursor.fetchone()
        conn.commit()

        return device

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def update_device_status(device_id, status):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE devices
            SET status = %s
            WHERE device_id = %s
            RETURNING
                device_id,
                room_id,
                device_type,
                device_name,
                status,
                last_seen,
                created_at
        """, (
            status,
            device_id
        ))

        device = cursor.fetchone()
        conn.commit()

        return device

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()