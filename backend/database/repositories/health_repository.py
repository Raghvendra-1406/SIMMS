from database.connection import get_connection


def create_health_score(
    room_id,
    health_status,
    health_score=None,
    active_fault_count=0,
    occupancy_count=0,
    temperature=None,
    humidity=None,
    power=None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO health_scores (
                room_id,
                health_status,
                health_score,
                active_fault_count,
                occupancy_count,
                temperature,
                humidity,
                power
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING
                health_id,
                room_id,
                health_status,
                health_score,
                active_fault_count,
                occupancy_count,
                temperature,
                humidity,
                power,
                calculated_at
        """, (
            room_id,
            health_status,
            health_score,
            active_fault_count,
            occupancy_count,
            temperature,
            humidity,
            power
        ))

        health = cursor.fetchone()
        conn.commit()

        return health

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_health_score_by_id(health_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                health_id,
                room_id,
                health_status,
                health_score,
                active_fault_count,
                occupancy_count,
                temperature,
                humidity,
                power,
                calculated_at
            FROM health_scores
            WHERE health_id = %s
        """, (health_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_latest_health_score(room_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                health_id,
                room_id,
                health_status,
                health_score,
                active_fault_count,
                occupancy_count,
                temperature,
                humidity,
                power,
                calculated_at
            FROM health_scores
            WHERE room_id = %s
            ORDER BY calculated_at DESC, health_id DESC
            LIMIT 1
        """, (room_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_health_history(room_id, limit=20):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                health_id,
                room_id,
                health_status,
                health_score,
                active_fault_count,
                occupancy_count,
                temperature,
                humidity,
                power,
                calculated_at
            FROM health_scores
            WHERE room_id = %s
            ORDER BY calculated_at DESC, health_id DESC
            LIMIT %s
        """, (room_id, limit))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_all_latest_health_scores():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT DISTINCT ON (room_id)
                health_id,
                room_id,
                health_status,
                health_score,
                active_fault_count,
                occupancy_count,
                temperature,
                humidity,
                power,
                calculated_at
            FROM health_scores
            ORDER BY room_id, calculated_at DESC, health_id DESC
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()