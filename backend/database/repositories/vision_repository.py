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
