from database.connection import get_connection


def get_all_rooms():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                room_id,
                room_name,
                room_type,
                building,
                floor,
                capacity,
                status,
                created_at
            FROM rooms
            ORDER BY room_id
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_room_by_id(room_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                room_id,
                room_name,
                room_type,
                building,
                floor,
                capacity,
                status,
                created_at
            FROM rooms
            WHERE room_id = %s
        """, (room_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def create_room(
    room_name,
    room_type,
    building=None,
    floor=None,
    capacity=None,
    status="ACTIVE"
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO rooms (
                room_name,
                room_type,
                building,
                floor,
                capacity,
                status
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING
                room_id,
                room_name,
                room_type,
                building,
                floor,
                capacity,
                status,
                created_at
        """, (
            room_name,
            room_type,
            building,
            floor,
            capacity,
            status
        ))

        room = cursor.fetchone()
        conn.commit()

        return room

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def update_room(
    room_id,
    room_name,
    room_type,
    building=None,
    floor=None,
    capacity=None,
    status="ACTIVE"
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE rooms
            SET
                room_name = %s,
                room_type = %s,
                building = %s,
                floor = %s,
                capacity = %s,
                status = %s
            WHERE room_id = %s
            RETURNING
                room_id,
                room_name,
                room_type,
                building,
                floor,
                capacity,
                status,
                created_at
        """, (
            room_name,
            room_type,
            building,
            floor,
            capacity,
            status,
            room_id
        ))

        room = cursor.fetchone()
        conn.commit()

        return room

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def delete_room(room_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            DELETE FROM rooms
            WHERE room_id = %s
            RETURNING room_id
        """, (room_id,))

        deleted_room = cursor.fetchone()
        conn.commit()

        return deleted_room

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()