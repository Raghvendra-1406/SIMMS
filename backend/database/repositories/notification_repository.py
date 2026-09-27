from database.connection import get_connection


def create_notification(
    user_id,
    notification_type,
    message,
    ticket_id=None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO notifications (
                user_id,
                ticket_id,
                notification_type,
                message
            )
            VALUES (%s, %s, %s, %s)
            RETURNING
                notification_id,
                user_id,
                ticket_id,
                notification_type,
                message,
                is_read,
                created_at
        """, (
            user_id,
            ticket_id,
            notification_type,
            message
        ))

        notification = cursor.fetchone()
        conn.commit()

        return notification

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_notification_by_id(notification_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                notification_id,
                user_id,
                ticket_id,
                notification_type,
                message,
                is_read,
                created_at
            FROM notifications
            WHERE notification_id = %s
        """, (notification_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_notifications_by_user(user_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                notification_id,
                user_id,
                ticket_id,
                notification_type,
                message,
                is_read,
                created_at
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
        """, (user_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_unread_notifications(user_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                notification_id,
                user_id,
                ticket_id,
                notification_type,
                message,
                is_read,
                created_at
            FROM notifications
            WHERE user_id = %s
              AND is_read = FALSE
            ORDER BY created_at DESC
        """, (user_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def mark_notification_as_read(notification_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE notification_id = %s
            RETURNING
                notification_id,
                user_id,
                ticket_id,
                notification_type,
                message,
                is_read,
                created_at
        """, (notification_id,))

        notification = cursor.fetchone()
        conn.commit()

        return notification

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def mark_all_notifications_as_read(user_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE user_id = %s
              AND is_read = FALSE
            RETURNING notification_id
        """, (user_id,))

        notifications = cursor.fetchall()
        conn.commit()

        return notifications

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()