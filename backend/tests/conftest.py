"""
Test setup: a throwaway PostgreSQL with schema.sql, never the real one.

Database:
  - TEST_DATABASE_URL if set (CI: a postgres service container), else
  - an embedded PostgreSQL started with pgserver (pip install pgserver),
    in a temporary folder, removed afterwards.

The URL must point at localhost: the suite truncates every table.

backend/.env is NOT read: dotenv is disabled before the app's settings
load, so every setting is its code default plus TEST_ENV below. Tests
therefore behave the same on every machine and in CI.
"""

import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import pytest

BACKEND = Path(__file__).resolve().parents[1]

sys.path.insert(0, str(BACKEND))

TEST_ENV = {
    "JWT_SECRET_KEY": "test-only-secret",
    "MQTT_BROKER_HOST": "127.0.0.1",
    "VACANCY_MINUTES": "10",
    "COOLDOWN_MINUTES": "30",
    "VAPID_PUBLIC_KEY": "",
    "VAPID_PRIVATE_KEY": "",
}

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", None, ""}

_server = None


def _start_database():
    global _server

    url = os.environ.get("TEST_DATABASE_URL")

    if url:
        return url

    try:
        import pgserver
    except ImportError:
        pytest.exit(
            "No test database: set TEST_DATABASE_URL to a local PostgreSQL "
            "or `pip install pgserver` (see backend/requirements-dev.txt).",
            returncode=4,
        )

    _server = pgserver.get_server(
        tempfile.mkdtemp(prefix="simms_test_pg_"),
        cleanup_mode="delete",
    )

    return _server.get_uri()


def pytest_configure(config):
    # Never read backend/.env (real database, demo timings, push keys).
    import dotenv

    dotenv.load_dotenv = lambda *args, **kwargs: False

    url = _start_database()

    host = urlparse(url).hostname

    if host not in LOCAL_HOSTS:
        pytest.exit(f"Refusing to run tests against non-local database host {host!r}.", returncode=4)

    os.environ.update(TEST_ENV)
    os.environ["DATABASE_URL"] = url

    import psycopg2

    conn = psycopg2.connect(url)
    conn.autocommit = True

    with conn.cursor() as cursor:
        cursor.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
        cursor.execute((BACKEND / "database" / "schema.sql").read_text(encoding="utf-8"))

    conn.close()


def pytest_unconfigure(config):
    if _server is not None:
        _server.cleanup()


# ---------------------------------------------------------
# Per-test reset
# ---------------------------------------------------------

def _all_tables(cursor):
    cursor.execute("""
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    """)
    return [row[0] for row in cursor.fetchall()]


@pytest.fixture(autouse=True)
def clean_state():
    """
    Empty tables, caches and in-memory confirmation windows.
    """

    from database.connection import get_connection
    from database.repositories import (
        circuit_baseline_repository,
        device_repository,
        room_repository,
    )
    from services import temporal_processor

    conn = get_connection()
    cursor = conn.cursor()
    tables = ", ".join(_all_tables(cursor))
    cursor.execute(f"TRUNCATE {tables} RESTART IDENTITY CASCADE")
    conn.commit()
    cursor.close()
    conn.close()

    room_repository._room_cache.clear()
    device_repository._device_cache.clear()
    circuit_baseline_repository._baseline_cache.clear()

    with temporal_processor._windows_lock:
        temporal_processor._windows.clear()
        temporal_processor._vote_times.clear()
        temporal_processor._confirmed_streaks.clear()
        temporal_processor._recovered_states.clear()

    yield


# ---------------------------------------------------------
# Data helpers
# ---------------------------------------------------------

@pytest.fixture
def sql():
    """
    sql("select ...", params) -> rows (or rowcount for writes).
    """

    from database.connection import get_connection

    def run(query, params=()):
        conn = get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(query, params)
            rows = cursor.fetchall() if cursor.description else cursor.rowcount
            conn.commit()
            return rows

        finally:
            cursor.close()
            conn.close()

    return run


def _create_user(name, email, role, team=None):
    from database.repositories.ticket_routing_repository import set_user_team
    from services.auth_service import register_user

    user = register_user(name=name, email=email, password="password123", role=role)

    if team:
        set_user_team(user[0], team)

    return {"user_id": user[0], "name": name, "email": email, "role": role}


@pytest.fixture
def users():
    return {
        "admin": _create_user("Admin", "admin@example.com", "ADMIN"),
        "supervisor": _create_user("Supervisor", "sup@example.com", "SUPERVISOR"),
        "electrician": _create_user("Electrician", "elec@example.com", "MAINTENANCE_STAFF", "ELECTRICAL"),
        "housekeeper": _create_user("Housekeeper", "house@example.com", "MAINTENANCE_STAFF", "HOUSEKEEPING"),
    }


@pytest.fixture
def room():
    """
    Room R1 with Fan 1-6, Tube 1-6, ESP32 Node and Camera.
    Returns {"room_id", "name", "devices": {name: device_id}}.
    """

    from database.repositories.device_repository import get_devices_by_room
    from database.repositories.room_repository import create_room
    from services.device_service import add_standard_devices

    created = create_room(room_name="R1", room_type="CLASSROOM", building="Test", floor=1, capacity=40)
    room_id = created[0]

    add_standard_devices(room_id, fan_count=6, light_count=6, include_nodes=True)

    return {
        "room_id": room_id,
        "name": "R1",
        "devices": {d[3]: d[0] for d in get_devices_by_room(room_id)},
    }


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    import main

    # No context manager: the lifespan (MQTT, scheduler) does not start.
    return TestClient(main.app)


@pytest.fixture
def auth():
    """
    auth(user) -> Authorization header for that user.
    """

    from services.jwt_service import create_access_token

    def headers(user):
        return {"Authorization": "Bearer " + create_access_token(user)}

    return headers
