from database.connection import get_connection


def create_ticket_history(
    ticket_id,
    previous_status,
    new_status,
    changed_by=None,
    note=None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO ticket_history (
                ticket_id,
                previous_status,
                new_status,
                changed_by,
                note
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING
                history_id,
                ticket_id,
                previous_status,
                new_status,
                changed_at,
                changed_by,
                note
        """, (
            ticket_id,
            previous_status,
            new_status,
            changed_by,
            note
        ))

        history = cursor.fetchone()
        conn.commit()

        return history

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_ticket_history(ticket_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                history_id,
                ticket_id,
                previous_status,
                new_status,
                changed_at,
                changed_by,
                note
            FROM ticket_history
            WHERE ticket_id = %s
            ORDER BY changed_at ASC, history_id ASC
        """, (ticket_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_latest_ticket_history(ticket_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                history_id,
                ticket_id,
                previous_status,
                new_status,
                changed_at,
                changed_by,
                note
            FROM ticket_history
            WHERE ticket_id = %s
            ORDER BY changed_at DESC, history_id DESC
            LIMIT 1
        """, (ticket_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_ticket_history_by_id(history_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                history_id,
                ticket_id,
                previous_status,
                new_status,
                changed_at,
                changed_by,
                note
            FROM ticket_history
            WHERE history_id = %s
        """, (history_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()