from database.connection import get_connection
from psycopg2.extras import Json

def create_sensor_observation(
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
            INSERT INTO sensor_observations (
                room_id,
                device_id,
                observed_at,
                observation_type,
                observation_data
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING
                observation_id,
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


def get_sensor_observation_by_id(observation_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                observation_id,
                room_id,
                device_id,
                observed_at,
                observation_type,
                observation_data,
                created_at
            FROM sensor_observations
            WHERE observation_id = %s
        """, (observation_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_sensor_observations_by_room(room_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                observation_id,
                room_id,
                device_id,
                observed_at,
                observation_type,
                observation_data,
                created_at
            FROM sensor_observations
            WHERE room_id = %s
            ORDER BY observed_at DESC
        """, (room_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_sensor_observations_by_device(device_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                observation_id,
                room_id,
                device_id,
                observed_at,
                observation_type,
                observation_data,
                created_at
            FROM sensor_observations
            WHERE device_id = %s
            ORDER BY observed_at DESC
        """, (device_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_latest_sensor_observation(room_id, observation_type=None):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if observation_type is not None:
            cursor.execute("""
                SELECT
                    observation_id,
                    room_id,
                    device_id,
                    observed_at,
                    observation_type,
                    observation_data,
                    created_at
                FROM sensor_observations
                WHERE room_id = %s
                  AND observation_type = %s
                ORDER BY observed_at DESC
                LIMIT 1
            """, (room_id, observation_type))

        else:
            cursor.execute("""
                SELECT
                    observation_id,
                    room_id,
                    device_id,
                    observed_at,
                    observation_type,
                    observation_data,
                    created_at
                FROM sensor_observations
                WHERE room_id = %s
                ORDER BY observed_at DESC
                LIMIT 1
            """, (room_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_recent_sensor_observations(
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
                    observation_id,
                    room_id,
                    device_id,
                    observed_at,
                    observation_type,
                    observation_data,
                    created_at
                FROM sensor_observations
                WHERE room_id = %s
                  AND observation_type = %s
                ORDER BY observed_at DESC
                LIMIT %s
            """, (room_id, observation_type, limit))

        else:
            cursor.execute("""
                SELECT
                    observation_id,
                    room_id,
                    device_id,
                    observed_at,
                    observation_type,
                    observation_data,
                    created_at
                FROM sensor_observations
                WHERE room_id = %s
                ORDER BY observed_at DESC
                LIMIT %s
            """, (room_id, limit))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()