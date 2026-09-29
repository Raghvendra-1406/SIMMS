from database.connection import get_connection
from psycopg2.extras import Json

def create_vision_observation(
    room_id,
    device_id,
    observed_at,
    observation_type,
    observation_data
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO vision_observations (
                room_id,
                device_id,
                observed_at,
                observation_type,
                observation_data
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING
                vision_observation_id,
                room_id,
                device_id,
                observed_at,
                observation_type,
                observation_data,
                created_at
        """, (
            room_id,
            device_id,
            observed_at,
            observation_type,
            Json(observation_data)
        ))

        observation = cursor.fetchone()
        conn.commit()

        return observation

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_vision_observation_by_id(vision_observation_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                vision_observation_id,
                room_id,
                device_id,
                observed_at,
                observation_type,
                observation_data,
                created_at
            FROM vision_observations
            WHERE vision_observation_id = %s
        """, (vision_observation_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_vision_observations_by_room(room_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                vision_observation_id,
                room_id,
                device_id,
                observed_at,
                observation_type,
                observation_data,
                created_at
            FROM vision_observations
            WHERE room_id = %s
            ORDER BY observed_at DESC
        """, (room_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_vision_observations_by_device(device_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                vision_observation_id,
                room_id,
                device_id,
                observed_at,
                observation_type,
                observation_data,
                created_at
            FROM vision_observations
            WHERE device_id = %s
            ORDER BY observed_at DESC
        """, (device_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_latest_vision_observation(
    room_id,
    observation_type=None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if observation_type is not None:
            cursor.execute("""
                SELECT
                    vision_observation_id,
                    room_id,
                    device_id,
                    observed_at,
                    observation_type,
                    observation_data,
                    created_at
                FROM vision_observations
                WHERE room_id = %s
                  AND observation_type = %s
                ORDER BY observed_at DESC
                LIMIT 1
            """, (room_id, observation_type))

        else:
            cursor.execute("""
                SELECT
                    vision_observation_id,
                    room_id,
                    device_id,
                    observed_at,
                    observation_type,
                    observation_data,
                    created_at
                FROM vision_observations
                WHERE room_id = %s
                ORDER BY observed_at DESC
                LIMIT 1
            """, (room_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_recent_vision_observations(
    room_id,
    observation_type=None,
    limit=10
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if observation_type is not None:
            cursor.execute("""
                SELECT
                    vision_observation_id,
                    room_id,
                    device_id,
                    observed_at,
                    observation_type,
                    observation_data,
                    created_at
                FROM vision_observations
                WHERE room_id = %s
                  AND observation_type = %s
                ORDER BY observed_at DESC
                LIMIT %s
            """, (room_id, observation_type, limit))

        else:
            cursor.execute("""
                SELECT
                    vision_observation_id,
                    room_id,
                    device_id,
                    observed_at,
                    observation_type,
                    observation_data,
                    created_at
                FROM vision_observations
                WHERE room_id = %s
                ORDER BY observed_at DESC
                LIMIT %s
            """, (room_id, limit))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()

def get_latest_device_vision_observation(
    device_id,
    observation_type
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                vision_observation_id,
                room_id,
                device_id,
                observed_at,
                observation_type,
                observation_data,
                created_at
            FROM vision_observations
            WHERE device_id = %s
              AND observation_type = %s
            ORDER BY observed_at DESC
            LIMIT 1
        """, (device_id, observation_type))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_room_vacancy(
    room_id,
    lookback_minutes=120
):
    """
    How long the room has been vacant, from OCCUPANCY
    observations in the last lookback_minutes.

    Vacant since = the first zero-occupancy observation after
    the last observation in which someone was present.

    Returns:
        (latest_occupancy_count,
         minutes_since_latest_observation,
         vacant_minutes)
        or None when there are no recent observations.
        vacant_minutes is None when the room is occupied.
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            WITH obs AS (
                SELECT
                    observed_at,
                    (observation_data->>'occupancy_count')::int
                        AS occupancy_count
                FROM vision_observations
                WHERE room_id = %s
                  AND observation_type = 'OCCUPANCY'
                  AND observed_at >
                      CURRENT_TIMESTAMP
                      - %s * INTERVAL '1 minute'
            ),
            latest AS (
                SELECT observed_at, occupancy_count
                FROM obs
                ORDER BY observed_at DESC
                LIMIT 1
            ),
            last_occupied AS (
                SELECT MAX(observed_at) AS observed_at
                FROM obs
                WHERE occupancy_count > 0
            ),
            vacant_since AS (
                SELECT MIN(obs.observed_at) AS observed_at
                FROM obs, last_occupied
                WHERE obs.occupancy_count = 0
                  AND (
                      last_occupied.observed_at IS NULL
                      OR obs.observed_at > last_occupied.observed_at
                  )
            )
            SELECT
                latest.occupancy_count,
                EXTRACT(
                    EPOCH FROM (CURRENT_TIMESTAMP - latest.observed_at)
                ) / 60.0,
                EXTRACT(
                    EPOCH FROM (CURRENT_TIMESTAMP - vacant_since.observed_at)
                ) / 60.0
            FROM latest
            CROSS JOIN vacant_since;
        """, (room_id, lookback_minutes))

        row = cursor.fetchone()

        if row is None:
            return None

        latest_count, latest_age, vacant_minutes = row

        return (
            latest_count,
            float(latest_age),
            (
                float(vacant_minutes)
                if latest_count == 0 and vacant_minutes is not None
                else None
            )
        )

    finally:
        cursor.close()
        conn.close()
