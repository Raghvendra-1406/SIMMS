from database.connection import get_connection


def create_user(
    name,
    email,
    password_hash,
    role,
    is_active=True
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO users (
                name,
                email,
                password_hash,
                role,
                is_active
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING
                user_id,
                name,
                email,
                password_hash,
                role,
                created_at,
                is_active
        """, (
            name,
            email,
            password_hash,
            role,
            is_active
        ))

        user = cursor.fetchone()
        conn.commit()

        return user

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_user_by_id(user_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                user_id,
                name,
                email,
                password_hash,
                role,
                created_at,
                is_active
            FROM users
            WHERE user_id = %s
        """, (user_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_user_by_email(email):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                user_id,
                name,
                email,
                password_hash,
                role,
                created_at,
                is_active
            FROM users
            WHERE email = %s
        """, (email,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                user_id,
                name,
                email,
                password_hash,
                role,
                created_at,
                is_active
            FROM users
            ORDER BY user_id
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_users_by_role(role):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                user_id,
                name,
                email,
                password_hash,
                role,
                created_at,
                is_active
            FROM users
            WHERE role = %s
            ORDER BY user_id
        """, (role,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def update_user(
    user_id,
    name,
    email,
    role,
    is_active=True
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE users
            SET
                name = %s,
                email = %s,
                role = %s,
                is_active = %s
            WHERE user_id = %s
            RETURNING
                user_id,
                name,
                email,
                password_hash,
                role,
                created_at,
                is_active
        """, (
            name,
            email,
            role,
            is_active,
            user_id
        ))

        user = cursor.fetchone()
        conn.commit()

        return user

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def update_password_hash(user_id, password_hash):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE users
            SET password_hash = %s
            WHERE user_id = %s
            RETURNING
                user_id,
                name,
                email,
                password_hash,
                role,
                created_at,
                is_active
        """, (
            password_hash,
            user_id
        ))

        user = cursor.fetchone()
        conn.commit()

        return user

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def update_user_status(user_id, is_active):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE users
            SET is_active = %s
            WHERE user_id = %s
            RETURNING
                user_id,
                name,
                email,
                password_hash,
                role,
                created_at,
                is_active
        """, (
            is_active,
            user_id
        ))

        user = cursor.fetchone()
        conn.commit()

        return user

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()