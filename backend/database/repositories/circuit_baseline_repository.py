from database.cache import TTLCache
from database.connection import get_connection


# Read on every electrical / vision message; changes only when an
# admin learns or edits a baseline.
_baseline_cache = TTLCache(ttl_seconds=60)


def get_room_baselines(room_id):
    """
    {circuit: (unit_current_a, standby_current_a, learned_units, learned_at)}
    for the room's learned baselines.
    """

    cached = _baseline_cache.get(room_id)

    if cached is not None:
        return cached

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                circuit,
                unit_current_a,
                standby_current_a,
                learned_units,
                learned_at
            FROM circuit_baselines
            WHERE room_id = %s
        """, (room_id,))

        baselines = {
            row[0]: (float(row[1]), float(row[2]), row[3], row[4])
            for row in cursor.fetchall()
        }

    finally:
        cursor.close()
        conn.close()

    _baseline_cache.set(room_id, baselines)

    return baselines


def get_all_baselines():
    """
    {room_id: {circuit: (unit, standby, learned_units, learned_at)}}
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                room_id,
                circuit,
                unit_current_a,
                standby_current_a,
                learned_units,
                learned_at
            FROM circuit_baselines
        """)

        baselines = {}

        for row in cursor.fetchall():
            baselines.setdefault(row[0], {})[row[1]] = (
                float(row[2]),
                float(row[3]),
                row[4],
                row[5],
            )

        return baselines

    finally:
        cursor.close()
        conn.close()


def upsert_baseline(
    room_id,
    circuit,
    unit_current_a,
    standby_current_a,
    learned_units=None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO circuit_baselines (
                room_id,
                circuit,
                unit_current_a,
                standby_current_a,
                learned_units
            )
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (room_id, circuit) DO UPDATE SET
                unit_current_a = EXCLUDED.unit_current_a,
                standby_current_a = EXCLUDED.standby_current_a,
                learned_units = EXCLUDED.learned_units,
                learned_at = CURRENT_TIMESTAMP
            RETURNING
                circuit,
                unit_current_a,
                standby_current_a,
                learned_units,
                learned_at
        """, (
            room_id,
            circuit,
            unit_current_a,
            standby_current_a,
            learned_units
        ))

        row = cursor.fetchone()
        conn.commit()

        _baseline_cache.clear()

        return row

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()
