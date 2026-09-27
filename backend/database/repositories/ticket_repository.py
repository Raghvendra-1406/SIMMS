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

        elif status == "CLOSED":
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
                  AND t.status = 'CLOSED'
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
                  AND t.status = 'CLOSED'
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