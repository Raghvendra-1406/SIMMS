from database.connection import get_connection


# Routing / SLA columns live beside the ticket row but are read and
# written here, so the ticket tuples used across the code base keep
# their shape.

ROUTING_COLUMNS = """
    t.ticket_id,
    t.category,
    t.assigned_to,
    u.name AS assigned_to_name,
    u.team AS assigned_to_team,
    t.assigned_at,
    t.sla_started_at,
    t.sla_due_at,
    t.started_at,
    t.escalated_at
"""

ACTIVE_STATUSES = "('OPEN', 'REOPENED', 'RESOLVED')"


def _fetch_dicts(sql, params=()):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(sql, params)

        columns = [c[0] for c in cursor.description]

        return [
            dict(zip(columns, row))
            for row in cursor.fetchall()
        ]

    finally:
        cursor.close()
        conn.close()


def _execute(sql, params=()):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(sql, params)
        rowcount = cursor.rowcount
        conn.commit()

        return rowcount

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_ticket_routing(ticket_ids):
    """
    {ticket_id: routing dict} for the given tickets.
    """

    ids = list({int(ticket_id) for ticket_id in ticket_ids})

    if not ids:
        return {}

    rows = _fetch_dicts(f"""
        SELECT {ROUTING_COLUMNS}
        FROM tickets t
        LEFT JOIN users u ON u.user_id = t.assigned_to
        WHERE t.ticket_id = ANY(%s)
    """, (ids,))

    return {row["ticket_id"]: row for row in rows}


def get_ticket_ids_assigned_to(user_id):
    rows = _fetch_dicts(f"""
        SELECT ticket_id
        FROM tickets
        WHERE assigned_to = %s
          AND status IN {ACTIVE_STATUSES}
    """, (user_id,))

    return [row["ticket_id"] for row in rows]


def set_ticket_routing(
    ticket_id,
    category,
    assigned_to,
    sla_due_at
):
    _execute("""
        UPDATE tickets
        SET category = %s,
            assigned_to = %s,
            assigned_at = CASE
                WHEN %s::int IS NULL THEN NULL
                ELSE CURRENT_TIMESTAMP
            END,
            sla_started_at = CURRENT_TIMESTAMP,
            sla_due_at = %s,
            started_at = NULL,
            escalated_at = NULL
        WHERE ticket_id = %s
    """, (category, assigned_to, assigned_to, sla_due_at, ticket_id))


def set_ticket_assignee(ticket_id, user_id):
    _execute("""
        UPDATE tickets
        SET assigned_to = %s,
            assigned_at = CASE
                WHEN %s::int IS NULL THEN NULL
                ELSE CURRENT_TIMESTAMP
            END
        WHERE ticket_id = %s
    """, (user_id, user_id, ticket_id))


def mark_ticket_started(ticket_id):
    _execute("""
        UPDATE tickets
        SET started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
        WHERE ticket_id = %s
    """, (ticket_id,))


def restart_ticket_sla(ticket_id, sla_due_at):
    _execute("""
        UPDATE tickets
        SET sla_started_at = CURRENT_TIMESTAMP,
            sla_due_at = %s,
            started_at = NULL,
            escalated_at = NULL
        WHERE ticket_id = %s
    """, (sla_due_at, ticket_id))


def set_ticket_sla_due(ticket_id, sla_due_at):
    _execute("""
        UPDATE tickets
        SET sla_due_at = %s
        WHERE ticket_id = %s
    """, (sla_due_at, ticket_id))


def get_breached_tickets():
    """
    Active tickets nobody has started whose response SLA has passed
    and whose breach has not been handled yet.
    """

    return _fetch_dicts("""
        SELECT
            t.ticket_id,
            t.fault_id,
            t.priority,
            t.status,
            t.assigned_to,
            t.sla_due_at
        FROM tickets t
        WHERE t.status IN ('OPEN', 'REOPENED')
          AND t.started_at IS NULL
          AND t.escalated_at IS NULL
          AND t.sla_due_at IS NOT NULL
          AND t.sla_due_at < CURRENT_TIMESTAMP
        ORDER BY t.sla_due_at
    """)


def mark_ticket_escalated(ticket_id):
    """
    Returns True only for the caller that marked it (no double
    escalation if two workers race).
    """

    return _execute("""
        UPDATE tickets
        SET escalated_at = CURRENT_TIMESTAMP
        WHERE ticket_id = %s
          AND escalated_at IS NULL
    """, (ticket_id,)) == 1


def get_maintenance_staff():
    """
    Active maintenance staff with their team and active-ticket load.
    """

    return _fetch_dicts(f"""
        SELECT
            u.user_id,
            u.name,
            u.email,
            u.team,
            (
                SELECT COUNT(*)
                FROM tickets t
                WHERE t.assigned_to = u.user_id
                  AND t.status IN {ACTIVE_STATUSES}
            ) AS active_tickets
        FROM users u
        WHERE u.role = 'MAINTENANCE_STAFF'
          AND u.is_active
        ORDER BY u.name
    """)


def get_user_teams(user_ids=None):
    """
    {user_id: team}; all users when user_ids is None.
    """

    if user_ids is None:
        rows = _fetch_dicts("SELECT user_id, team FROM users")
    else:
        rows = _fetch_dicts(
            "SELECT user_id, team FROM users WHERE user_id = ANY(%s)",
            (list(user_ids),)
        )

    return {row["user_id"]: row["team"] for row in rows}


def set_user_team(user_id, team):
    _execute(
        "UPDATE users SET team = %s WHERE user_id = %s",
        (team, user_id)
    )
