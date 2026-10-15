from psycopg2.extras import Json

from database.connection import get_connection


def create_health_score(
    room_id,
    health_status,
    health_score=None,
    active_fault_count=0,
    occupancy_count=0,
    temperature=None,
    humidity=None,
    power=None,
    components=None
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
                power,
                components
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
            power,
            Json(components) if components is not None else None
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
                calculated_at,
                components
            FROM health_scores
            ORDER BY room_id, calculated_at DESC, health_id DESC
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


# Everything the CIHS needs for one room in one round trip.
HEALTH_INPUTS_SQL = """
SELECT json_build_object(
    'fans_total', (
        SELECT COUNT(*) FROM devices
        WHERE room_id = %(room_id)s AND device_type = 'FAN'
    ),
    'lights_total', (
        SELECT COUNT(*) FROM devices
        WHERE room_id = %(room_id)s AND device_type = 'LIGHT'
    ),
    'faults', COALESCE((
        SELECT json_agg(json_build_object(
            'fault_type', fault_type,
            'device_id', device_id,
            'detected_at', detected_at
        ))
        FROM fault_events
        WHERE room_id = %(room_id)s
          AND status IN ('OPEN', 'REOPENED')
    ), '[]'::json),
    'tickets', COALESCE((
        SELECT json_agg(json_build_object(
            'ticket_id', t.ticket_id,
            'priority', t.priority,
            'status', t.status,
            'created_at', t.created_at,
            'sla_due_at', t.sla_due_at,
            'started_at', t.started_at
        ))
        FROM tickets t
        JOIN fault_events f ON f.fault_id = t.fault_id
        WHERE f.room_id = %(room_id)s
          AND t.status IN ('OPEN', 'REOPENED', 'RESOLVED')
    ), '[]'::json),
    'nodes', COALESCE((
        SELECT json_agg(json_build_object(
            'node_id', node_id,
            'kind', kind,
            'state', state
        ))
        FROM node_status
        WHERE room_id = %(room_id)s
    ), '[]'::json)
)
"""


def get_room_health_inputs(room_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(HEALTH_INPUTS_SQL, {"room_id": room_id})

        return cursor.fetchone()[0]

    finally:
        cursor.close()
        conn.close()
