"""Offline buffering (Plan v2 §16 T12): replayed readings keep their real
time and never vote in fault confirmation."""

from datetime import datetime, timedelta, timezone

import pytest

import mqtt.subscriber as sub


def test_observed_time_sources():
    now = datetime.now(timezone.utc)

    stamped = sub.observed_time({"timestamp": (now - timedelta(minutes=5)).isoformat()})
    assert abs((stamped - (now - timedelta(minutes=5))).total_seconds()) < 1

    assert sub.observed_time({"timestamp": "2026-10-15T10:00:00Z"}).tzinfo is not None
    assert sub.observed_time({"timestamp": (now + timedelta(hours=1)).isoformat()}) <= datetime.now(timezone.utc)
    assert abs((now - sub.observed_time({"age_s": 600})).total_seconds() - 600) < 2
    assert abs((sub.observed_time({"timestamp": "garbage"}) - now).total_seconds()) < 2


def test_only_recent_readings_are_live():
    now = datetime.now(timezone.utc)
    assert sub.is_live(now - timedelta(seconds=5))
    assert not sub.is_live(now - timedelta(minutes=10))


@pytest.fixture
def processed(monkeypatch):
    calls = []
    monkeypatch.setattr(sub, "process_electrical_observation",
                        lambda room_id: calls.append(room_id) or {"electrical": None, "energy": None})
    monkeypatch.setattr(sub, "report", lambda *a, **k: None)
    return calls


READING = {"node_id": "esp32-R1", "device_name": "ESP32 Node", "voltage": 230.0,
           "circuits": {"LIGHTS": {"current": 0.2, "power": 40, "power_factor": 0.9, "energy": 1.0}}}


def test_buffered_reading_is_stored_back_in_time_and_does_not_vote(room, sql, processed):
    sub.process_sensor_message((room["room_id"], "R1"), {**READING, "age_s": 600, "buffered": True})

    observed_at, data = sql("select observed_at, observation_data from sensor_observations")[0]
    assert abs((datetime.now(timezone.utc) - observed_at).total_seconds() - 600) < 10
    assert "age_s" not in data and "buffered" not in data
    assert processed == []


def test_live_reading_votes(room, processed):
    sub.process_sensor_message((room["room_id"], "R1"), READING)
    assert processed == [room["room_id"]]
