from database.connection import get_connection


# One row per ticket created in the period, with everything the
# statistics need: fault timing, first notification, whether it was
# ever reopened, and the human review verdict.
TICKETS_SQL = """
SELECT
    t.ticket_id,
    t.status,
    t.priority,
    t.created_at,
    t.resolved_at,
    t.closed_at,
    t.recurrence_count,
    f.fault_id,
    f.room_id,
    r.room_name,
    f.fault_type,
    f.device_id,
    d.device_name,
    f.detected_at,
    f.confirmed_at,
    (
        SELECT MIN(n.created_at)
        FROM notifications n
        WHERE n.ticket_id = t.ticket_id
    ) AS first_notified_at,
    EXISTS (
        SELECT 1
        FROM ticket_history h
        WHERE h.ticket_id = t.ticket_id
          AND h.new_status = 'REOPENED'
    ) AS was_reopened,
    rv.verdict,
    rv.note AS review_note,
    rv.reviewed_at
FROM tickets t
JOIN fault_events f ON f.fault_id = t.fault_id
JOIN rooms r ON r.room_id = f.room_id
LEFT JOIN devices d ON d.device_id = f.device_id
LEFT JOIN ticket_reviews rv ON rv.ticket_id = t.ticket_id
WHERE t.created_at >= %(start)s
  AND t.created_at < %(end)s
  AND (%(room_id)s::int IS NULL OR f.room_id = %(room_id)s)
ORDER BY t.created_at DESC
"""


# Data completeness: how many 5-minute slots in the period hold at
# least one reading, per room and source.
COVERAGE_SQL = """
SELECT
    room_id,
    source,
    COUNT(*) AS readings,
    COUNT(DISTINCT FLOOR(EXTRACT(EPOCH FROM observed_at) / 300))
        AS slots,
    MIN(observed_at) AS first_at,
    MAX(observed_at) AS last_at
FROM (
    SELECT room_id, observed_at, 'sensor' AS source
    FROM sensor_observations
    WHERE observed_at >= %(start)s
      AND observed_at < %(end)s
      AND (%(room_id)s::int IS NULL OR room_id = %(room_id)s)

    UNION ALL

    SELECT room_id, observed_at, 'vision' AS source
    FROM vision_observations
    WHERE observed_at >= %(start)s
      AND observed_at < %(end)s
      AND (%(room_id)s::int IS NULL OR room_id = %(room_id)s)
) o
GROUP BY room_id, source
"""


ROOMS_SQL = """
SELECT room_id, room_name
FROM rooms
WHERE status = 'ACTIVE'
  AND (%(room_id)s::int IS NULL OR room_id = %(room_id)s)
ORDER BY room_name
"""


def _fetch(sql, params):
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


def get_period_tickets(start, end, room_id=None):
    return _fetch(
        TICKETS_SQL,
        {"start": start, "end": end, "room_id": room_id}
    )


def get_period_coverage(start, end, room_id=None):
    return _fetch(
        COVERAGE_SQL,
        {"start": start, "end": end, "room_id": room_id}
    )


def get_stats_rooms(room_id=None):
    return _fetch(
        ROOMS_SQL,
        {"room_id": room_id}
    )


def upsert_ticket_review(ticket_id, verdict, note, reviewed_by):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO ticket_reviews (
                ticket_id, verdict, note, reviewed_by, reviewed_at
            )
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (ticket_id) DO UPDATE SET
                verdict = EXCLUDED.verdict,
                note = EXCLUDED.note,
                reviewed_by = EXCLUDED.reviewed_by,
                reviewed_at = EXCLUDED.reviewed_at
            RETURNING ticket_id, verdict, note, reviewed_by, reviewed_at
        """, (ticket_id, verdict, note, reviewed_by))

        row = cursor.fetchone()
        conn.commit()

        return dict(zip(
            ["ticket_id", "verdict", "note", "reviewed_by", "reviewed_at"],
            row
        ))

    finally:
        cursor.close()
        conn.close()


def delete_ticket_review(ticket_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "DELETE FROM ticket_reviews WHERE ticket_id = %s",
            (ticket_id,)
        )

        deleted = cursor.rowcount
        conn.commit()

        return deleted > 0

    finally:
        cursor.close()
        conn.close()
