from database.connection import get_connection


def _run(sql, params=(), fetch=False):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(sql, params)

        rows = None

        if fetch:
            columns = [c[0] for c in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        count = cursor.rowcount
        conn.commit()

        return rows if fetch else count

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def upsert_subscription(user_id, endpoint, p256dh, auth, user_agent=None):
    """
    A browser re-subscribing (or another user logging in on the same
    browser) takes over the endpoint.
    """

    return _run("""
        INSERT INTO push_subscriptions (
            user_id, endpoint, p256dh, auth, user_agent
        )
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (endpoint) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            user_agent = EXCLUDED.user_agent,
            last_error = NULL
        RETURNING subscription_id, user_id, endpoint, created_at
    """, (user_id, endpoint, p256dh, auth, user_agent), fetch=True)[0]


def delete_subscription(endpoint, user_id=None):
    if user_id is None:
        return _run(
            "DELETE FROM push_subscriptions WHERE endpoint = %s",
            (endpoint,)
        )

    return _run(
        "DELETE FROM push_subscriptions WHERE endpoint = %s AND user_id = %s",
        (endpoint, user_id)
    )


def get_user_subscriptions(user_id):
    return _run("""
        SELECT subscription_id, user_id, endpoint, p256dh, auth,
               user_agent, created_at, last_success_at, last_error
        FROM push_subscriptions
        WHERE user_id = %s
        ORDER BY created_at
    """, (user_id,), fetch=True)


def mark_subscription_result(subscription_id, error=None):
    if error is None:
        _run("""
            UPDATE push_subscriptions
            SET last_success_at = CURRENT_TIMESTAMP, last_error = NULL
            WHERE subscription_id = %s
        """, (subscription_id,))
    else:
        _run("""
            UPDATE push_subscriptions
            SET last_error = %s
            WHERE subscription_id = %s
        """, (str(error)[:500], subscription_id))
