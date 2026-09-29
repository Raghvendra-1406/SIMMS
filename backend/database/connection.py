from contextlib import contextmanager
from contextvars import ContextVar

import psycopg2

from config.settings import (
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    DATABASE_URL
)


# Connection shared by every repository call made inside
# transaction(). ContextVar keeps it isolated per thread,
# so the MQTT thread and API request threads never share one.
_active_connection = ContextVar(
    "simms_active_connection",
    default=None
)


class _SharedConnection:
    """
    Connection handle given to repositories inside transaction().

    Repositories call commit(), rollback() and close() after every
    statement. Inside a transaction those decisions belong to the
    transaction owner, so they are no-ops here.
    """

    def __init__(self, conn):
        self._conn = conn

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass


def _connect():
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)

    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def get_connection():
    shared_connection = _active_connection.get()

    if shared_connection is not None:
        return shared_connection

    return _connect()


@contextmanager
def transaction():
    """
    Run every repository call in the block on one connection
    and commit them together. Any exception rolls back all of it.

    Nested transaction() blocks join the outer transaction.
    """

    if _active_connection.get() is not None:
        yield
        return

    conn = _connect()
    token = _active_connection.set(
        _SharedConnection(conn)
    )

    try:
        yield
        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        _active_connection.reset(token)
        conn.close()
