from psycopg2.extras import Json

from database.connection import get_connection


NODE_COLUMNS = """
    node_status_id,
    room_id,
    node_id,
    kind,
    state,
    rssi,
    uptime_s,
    fw_version,
    details,
    last_seen,
    updated_at
"""


def upsert_node_status(
    room_id,
    node_id,
    state,
    kind=None,
    rssi=None,
    uptime_s=None,
    fw_version=None,
    details=None
):
    """
    Insert or update a node's status.

    ONLINE refreshes last_seen. OFFLINE (last-will or staleness)
    keeps the last time the node was actually heard from.
    Fields missing from the message keep their previous values.
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(f"""
            INSERT INTO node_status (
                room_id,
                node_id,
                kind,
                state,
                rssi,
                uptime_s,
                fw_version,
                details
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (room_id, node_id) DO UPDATE SET
                kind = COALESCE(EXCLUDED.kind, node_status.kind),
                state = EXCLUDED.state,
                rssi = COALESCE(EXCLUDED.rssi, node_status.rssi),
                uptime_s = COALESCE(EXCLUDED.uptime_s, node_status.uptime_s),
                fw_version = COALESCE(EXCLUDED.fw_version, node_status.fw_version),
                details = COALESCE(EXCLUDED.details, node_status.details),
                last_seen = CASE
                    WHEN EXCLUDED.state = 'ONLINE' THEN CURRENT_TIMESTAMP
                    ELSE node_status.last_seen
                END,
                updated_at = CURRENT_TIMESTAMP
            RETURNING {NODE_COLUMNS}
        """, (
            room_id,
            node_id,
            kind,
            state,
            rssi,
            uptime_s,
            fw_version,
            Json(details) if details is not None else None
        ))

        node = cursor.fetchone()
        conn.commit()

        return node

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def mark_stale_nodes_offline(offline_after_seconds):
    """
    Mark ONLINE nodes OFFLINE when nothing was heard from them
    for offline_after_seconds (covers a lost last-will message).
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(f"""
            UPDATE node_status
            SET state = 'OFFLINE',
                updated_at = CURRENT_TIMESTAMP
            WHERE state = 'ONLINE'
              AND last_seen <
                  CURRENT_TIMESTAMP - %s * INTERVAL '1 second'
            RETURNING {NODE_COLUMNS}
        """, (offline_after_seconds,))

        nodes = cursor.fetchall()
        conn.commit()

        return nodes

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_nodes_by_room(room_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(f"""
            SELECT {NODE_COLUMNS}
            FROM node_status
            WHERE room_id = %s
            ORDER BY node_id
        """, (room_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()
