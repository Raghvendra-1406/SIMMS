import threading
import time
from contextlib import contextmanager
from contextvars import ContextVar

import psycopg2
from psycopg2 import extensions, pool

from config.settings import (
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    DATABASE_URL,
    DB_POOL_MAX,
)


# Connection shared by every repository call made inside
# transaction(). ContextVar keeps it isolated per thread,
# so the MQTT thread and API request threads never share one.
_active_connection = ContextVar(
    "simms_active_connection",
    default=None
)


# A pooled connection unused for longer than this is checked
# with SELECT 1 before reuse. Cloud databases (e.g. Neon) drop
# idle connections, and a dead one would fail the next query.
_REVALIDATE_AFTER_SECONDS = 60

_pool = None
_pool_lock = threading.Lock()

# id(raw connection) -> time it was returned to the pool
_last_used = {}


def _connect_kwargs():
    if DATABASE_URL:
        return {"dsn": DATABASE_URL}

    return {
        "host": DB_HOST,
        "port": DB_PORT,
        "database": DB_NAME,
        "user": DB_USER,
        "password": DB_PASSWORD,
    }


def _get_pool():
    global _pool

    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = pool.ThreadedConnectionPool(
                    minconn=1,
                    maxconn=DB_POOL_MAX,
                    **_connect_kwargs()
                )

    return _pool


def _is_usable(conn):
    if conn.closed:
        return False

    last_used = _last_used.get(id(conn))

    if (
        last_used is not None
        and time.monotonic() - last_used < _REVALIDATE_AFTER_SECONDS
    ):
        return True

    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
        conn.rollback()
        return True

    except (psycopg2.OperationalError, psycopg2.InterfaceError):
        return False


def _checkout():
    """
    Take a working connection from the pool, replacing
    connections the server has already closed.
    """

    connection_pool = _get_pool()

    for _ in range(3):
        conn = connection_pool.getconn()

        if _is_usable(conn):
            return conn

        _last_used.pop(id(conn), None)
        connection_pool.putconn(conn, close=True)

    return connection_pool.getconn()


def _release(conn):
    """
    Return a connection to the pool. Anything left uncommitted
    is rolled back, so the next user starts clean.
    """

    connection_pool = _get_pool()

    if conn.closed:
        _last_used.pop(id(conn), None)
        connection_pool.putconn(conn, close=True)
        return

    try:
        if (
            conn.get_transaction_status()
            != extensions.TRANSACTION_STATUS_IDLE
        ):
            conn.rollback()

    except (psycopg2.OperationalError, psycopg2.InterfaceError):
        _last_used.pop(id(conn), None)
        connection_pool.putconn(conn, close=True)
        return

    _last_used[id(conn)] = time.monotonic()
    connection_pool.putconn(conn)


class _PooledConnection:
    """
    Connection handle given to repositories outside transaction().

    Runs in autocommit mode: every repository function outside
    transaction() is a single statement, so this is equivalent and
    saves the BEGIN/COMMIT round trips (significant on a cloud DB).

    Repositories call close() after every statement; here that
    returns the connection to the pool instead of closing it.
    """

    def __init__(self, conn):
        self._conn = conn
        self._released = False

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        if self._released:
            return

        self._released = True
        _release(self._conn)


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


def get_connection():
    shared_connection = _active_connection.get()

    if shared_connection is not None:
        return shared_connection

    conn = _checkout()
    conn.autocommit = True

    return _PooledConnection(conn)


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

    conn = _checkout()
    conn.autocommit = False

    token = _active_connection.set(
        _SharedConnection(conn)
    )

    try:
        yield
        conn.commit()

    except Exception:
        try:
            conn.rollback()
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            pass
        raise

    finally:
        _active_connection.reset(token)
        _release(conn)
