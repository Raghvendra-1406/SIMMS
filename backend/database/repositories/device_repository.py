from database.cache import TTLCache
from database.connection import get_connection


# get_device_by_id runs several times per MQTT message.
_device_cache = TTLCache(ttl_seconds=60)


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
    cached = _device_cache.get(device_id)

    if cached is not None:
        return cached

    device = _fetch_device_by_id(device_id)

    _device_cache.set(device_id, device)

    return device


def get_device_by_room_and_name(room_id, device_name):
    """
    Find a device in a room by name, ignoring case.
    Lets firmware refer to devices by name ("Fan 1")
    instead of database IDs.
    """

    cache_key = ("name", room_id, device_name.lower())

    cached = _device_cache.get(cache_key)

    if cached is not None:
        return cached

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
              AND LOWER(device_name) = LOWER(%s)
            ORDER BY device_id
            LIMIT 1
        """, (room_id, device_name))

        device = cursor.fetchone()

    finally:
        cursor.close()
        conn.close()

    _device_cache.set(cache_key, device)

    return device


def _fetch_device_by_id(device_id):
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

        _device_cache.clear()

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

        _device_cache.clear()

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

        _device_cache.clear()

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

        _device_cache.clear()

        return device

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()