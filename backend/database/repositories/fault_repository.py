from database.connection import get_connection


def create_fault_event(
    room_id,
    device_id,
    fault_type,
    detected_at,
    confidence=None,
    abnormal_count=None,
    recurrence_type=None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO fault_events (
                room_id,
                device_id,
                fault_type,
                detected_at,
                confidence,
                abnormal_count,
                recurrence_type
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING
                fault_id,
                room_id,
                device_id,
                fault_type,
                detected_at,
                confirmed_at,
                status,
                confidence,
                abnormal_count,
                recurrence_type,
                created_at
        """, (
            room_id,
            device_id,
            fault_type,
            detected_at,
            confidence,
            abnormal_count,
            recurrence_type
        ))

        fault = cursor.fetchone()
        conn.commit()

        return fault

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_fault_by_id(fault_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                fault_id,
                room_id,
                device_id,
                fault_type,
                detected_at,
                confirmed_at,
                status,
                confidence,
                abnormal_count,
                recurrence_type,
                created_at
            FROM fault_events
            WHERE fault_id = %s
        """, (fault_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_faults_by_room(room_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                fault_id,
                room_id,
                device_id,
                fault_type,
                detected_at,
                confirmed_at,
                status,
                confidence,
                abnormal_count,
                recurrence_type,
                created_at
            FROM fault_events
            WHERE room_id = %s
            ORDER BY detected_at DESC
        """, (room_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_active_faults_by_room(room_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                fault_id,
                room_id,
                device_id,
                fault_type,
                detected_at,
                confirmed_at,
                status,
                confidence,
                abnormal_count,
                recurrence_type,
                created_at
            FROM fault_events
            WHERE room_id = %s
              AND status IN ('OPEN', 'REOPENED')
            ORDER BY detected_at DESC
        """, (room_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_all_active_faults():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                fault_id,
                room_id,
                device_id,
                fault_type,
                detected_at,
                confirmed_at,
                status,
                confidence,
                abnormal_count,
                recurrence_type,
                created_at
            FROM fault_events
            WHERE status IN ('OPEN', 'REOPENED')
            ORDER BY detected_at DESC
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def confirm_fault(fault_id, confirmed_at):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE fault_events
            SET
                confirmed_at = %s,
                status = 'OPEN'
            WHERE fault_id = %s
            RETURNING
                fault_id,
                room_id,
                device_id,
                fault_type,
                detected_at,
                confirmed_at,
                status,
                confidence,
                abnormal_count,
                recurrence_type,
                created_at
        """, (confirmed_at, fault_id))

        fault = cursor.fetchone()
        conn.commit()

        return fault

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def update_fault_status(fault_id, status):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE fault_events
            SET status = %s
            WHERE fault_id = %s
            RETURNING
                fault_id,
                room_id,
                device_id,
                fault_type,
                detected_at,
                confirmed_at,
                status,
                confidence,
                abnormal_count,
                recurrence_type,
                created_at
        """, (status, fault_id))

        fault = cursor.fetchone()
        conn.commit()

        return fault

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def update_fault_recurrence_type(fault_id, recurrence_type):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE fault_events
            SET recurrence_type = %s
            WHERE fault_id = %s
            RETURNING
                fault_id,
                room_id,
                device_id,
                fault_type,
                detected_at,
                confirmed_at,
                status,
                confidence,
                abnormal_count,
                recurrence_type,
                created_at
        """, (
            recurrence_type,
            fault_id
        ))

        fault = cursor.fetchone()
        conn.commit()

        return fault

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()