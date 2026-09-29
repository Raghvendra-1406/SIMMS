from database.connection import get_connection


def create_ticket(
    fault_id,
    priority="MEDIUM",
    status="OPEN",
    maintenance_notes=None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO tickets (
                fault_id,
                priority,
                status,
                maintenance_notes
            )
            VALUES (%s, %s, %s, %s)
            RETURNING
                ticket_id,
                fault_id,
                priority,
                status,
                created_at,
                resolved_at,
                closed_at,
                maintenance_notes
        """, (
            fault_id,
            priority,
            status,
            maintenance_notes
        ))

        ticket = cursor.fetchone()
        conn.commit()

        return ticket

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_ticket_by_id(ticket_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                ticket_id,
                fault_id,
                priority,
                status,
                created_at,
                resolved_at,
                closed_at,
                maintenance_notes
            FROM tickets
            WHERE ticket_id = %s
        """, (ticket_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_all_tickets():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                ticket_id,
                fault_id,
                priority,
                status,
                created_at,
                resolved_at,
                closed_at,
                maintenance_notes
            FROM tickets
            ORDER BY created_at DESC
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_open_tickets():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                ticket_id,
                fault_id,
                priority,
                status,
                created_at,
                resolved_at,
                closed_at,
                maintenance_notes
            FROM tickets
            WHERE status IN ('OPEN', 'REOPENED')
            ORDER BY
                CASE priority
                    WHEN 'HIGH' THEN 1
                    WHEN 'MEDIUM' THEN 2
                    WHEN 'LOW' THEN 3
                    ELSE 4
                END,
                created_at ASC
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_tickets_by_fault(fault_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                ticket_id,
                fault_id,
                priority,
                status,
                created_at,
                resolved_at,
                closed_at,
                maintenance_notes
            FROM tickets
            WHERE fault_id = %s
            ORDER BY created_at DESC
        """, (fault_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def update_ticket_status(
    ticket_id,
    status,
    maintenance_notes=None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if status == "RESOLVED":
            cursor.execute("""
                UPDATE tickets
                SET
                    status = %s,
                    resolved_at = CURRENT_TIMESTAMP,
                    closed_at = NULL,
                    maintenance_notes = COALESCE(%s, maintenance_notes)
                WHERE ticket_id = %s
                RETURNING
                    ticket_id,
                    fault_id,
                    priority,
                    status,
                    created_at,
                    resolved_at,
                    closed_at,
                    maintenance_notes
            """, (
                status,
                maintenance_notes,
                ticket_id
            ))

        elif status in {"CLOSED", "AUTO_RESOLVED"}:
            cursor.execute("""
                UPDATE tickets
                SET
                    status = %s,
                    closed_at = CURRENT_TIMESTAMP,
                    maintenance_notes = COALESCE(%s, maintenance_notes)
                WHERE ticket_id = %s
                RETURNING
                    ticket_id,
                    fault_id,
                    priority,
                    status,
                    created_at,
                    resolved_at,
                    closed_at,
                    maintenance_notes
            """, (
                status,
                maintenance_notes,
                ticket_id
            ))

        else:
            cursor.execute("""
                UPDATE tickets
                SET
                    status = %s,
                    maintenance_notes = COALESCE(%s, maintenance_notes)
                WHERE ticket_id = %s
                RETURNING
                    ticket_id,
                    fault_id,
                    priority,
                    status,
                    created_at,
                    resolved_at,
                    closed_at,
                    maintenance_notes
            """, (
                status,
                maintenance_notes,
                ticket_id
            ))

        ticket = cursor.fetchone()
        conn.commit()

        return ticket

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def update_ticket_priority(ticket_id, priority):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE tickets
            SET priority = %s
            WHERE ticket_id = %s
            RETURNING
                ticket_id,
                fault_id,
                priority,
                status,
                created_at,
                resolved_at,
                closed_at,
                maintenance_notes
        """, (priority, ticket_id))

        ticket = cursor.fetchone()
        conn.commit()

        return ticket

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def update_maintenance_notes(ticket_id, maintenance_notes):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE tickets
            SET maintenance_notes = %s
            WHERE ticket_id = %s
            RETURNING
                ticket_id,
                fault_id,
                priority,
                status,
                created_at,
                resolved_at,
                closed_at,
                maintenance_notes
        """, (maintenance_notes, ticket_id))

        ticket = cursor.fetchone()
        conn.commit()

        return ticket

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_latest_closed_ticket_for_fault_identity(
    room_id,
    fault_type,
    device_id=None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if device_id is not None:
            cursor.execute("""
                SELECT
                    t.ticket_id,
                    t.fault_id,
                    t.priority,
                    t.status,
                    t.created_at,
                    t.resolved_at,
                    t.closed_at,
                    t.maintenance_notes
                FROM tickets t
                JOIN fault_events f
                    ON t.fault_id = f.fault_id
                WHERE f.room_id = %s
                  AND f.fault_type = %s
                  AND f.device_id = %s
                  AND t.status IN ('CLOSED', 'AUTO_RESOLVED')
                ORDER BY t.closed_at DESC
                LIMIT 1
            """, (
                room_id,
                fault_type,
                device_id
            ))

        else:
            cursor.execute("""
                SELECT
                    t.ticket_id,
                    t.fault_id,
                    t.priority,
                    t.status,
                    t.created_at,
                    t.resolved_at,
                    t.closed_at,
                    t.maintenance_notes
                FROM tickets t
                JOIN fault_events f
                    ON t.fault_id = f.fault_id
                WHERE f.room_id = %s
                  AND f.fault_type = %s
                  AND f.device_id IS NULL
                  AND t.status IN ('CLOSED', 'AUTO_RESOLVED')
                ORDER BY t.closed_at DESC
                LIMIT 1
            """, (
                room_id,
                fault_type
            ))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_latest_resolved_ticket_for_fault_identity(
    room_id,
    fault_type,
    device_id=None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if device_id is not None:
            cursor.execute("""
                SELECT
                    t.ticket_id,
                    t.fault_id,
                    t.priority,
                    t.status,
                    t.created_at,
                    t.resolved_at,
                    t.closed_at,
                    t.maintenance_notes
                FROM tickets t
                JOIN fault_events f
                    ON t.fault_id = f.fault_id
                WHERE f.room_id = %s
                  AND f.fault_type = %s
                  AND f.device_id = %s
                  AND t.status = 'RESOLVED'
                ORDER BY t.resolved_at DESC
                LIMIT 1
            """, (
                room_id,
                fault_type,
                device_id
            ))

        else:
            cursor.execute("""
                SELECT
                    t.ticket_id,
                    t.fault_id,
                    t.priority,
                    t.status,
                    t.created_at,
                    t.resolved_at,
                    t.closed_at,
                    t.maintenance_notes
                FROM tickets t
                JOIN fault_events f
                    ON t.fault_id = f.fault_id
                WHERE f.room_id = %s
                  AND f.fault_type = %s
                  AND f.device_id IS NULL
                  AND t.status = 'RESOLVED'
                ORDER BY t.resolved_at DESC
                LIMIT 1
            """, (
                room_id,
                fault_type
            ))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()

def get_hours_since_resolution(ticket_id):
    """
    Hours between the ticket's resolved_at and now, computed by
    PostgreSQL so both timestamps use the same clock and timezone.
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                EXTRACT(
                    EPOCH FROM (CURRENT_TIMESTAMP - resolved_at)
                ) / 3600
            FROM tickets
            WHERE ticket_id = %s
              AND resolved_at IS NOT NULL
        """, (ticket_id,))

        row = cursor.fetchone()

        if row is None or row[0] is None:
            return None

        return float(row[0])

    finally:
        cursor.close()
        conn.close()


def get_recently_closed_ticket_for_fault_identity(
    room_id,
    fault_type,
    device_id,
    within_minutes
):
    """
    Latest CLOSED / AUTO_RESOLVED ticket for this fault identity
    closed within the last within_minutes, or None.
    Used for the post-closure cooldown (Plan v2 §7.3).
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                t.ticket_id,
                t.fault_id,
                t.priority,
                t.status,
                t.created_at,
                t.resolved_at,
                t.closed_at,
                t.maintenance_notes
            FROM tickets t
            JOIN fault_events f
                ON t.fault_id = f.fault_id
            WHERE f.room_id = %s
              AND f.fault_type = %s
              AND f.device_id IS NOT DISTINCT FROM %s
              AND t.status IN ('CLOSED', 'AUTO_RESOLVED')
              AND t.closed_at >
                  CURRENT_TIMESTAMP - %s * INTERVAL '1 minute'
            ORDER BY t.closed_at DESC
            LIMIT 1
        """, (
            room_id,
            fault_type,
            device_id,
            within_minutes
        ))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def increment_ticket_recurrence(ticket_id):
    """
    Count one more recurrence of the ticket's fault.
    Returns the new recurrence_count.
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE tickets
            SET recurrence_count = recurrence_count + 1
            WHERE ticket_id = %s
            RETURNING recurrence_count
        """, (ticket_id,))

        row = cursor.fetchone()
        conn.commit()

        return row[0] if row else None

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def count_recent_recurrence_reopens(ticket_id, days):
    """
    Number of automatic (system) reopenings of this ticket
    in the last `days` days.
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT COUNT(*)
            FROM ticket_history
            WHERE ticket_id = %s
              AND new_status = 'REOPENED'
              AND changed_by IS NULL
              AND changed_at >
                  CURRENT_TIMESTAMP - %s * INTERVAL '1 day'
        """, (ticket_id, days))

        return cursor.fetchone()[0]

    finally:
        cursor.close()
        conn.close()
