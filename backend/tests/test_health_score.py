"""Classroom Infrastructure Health Score formula (Plan v2 §10)."""

from datetime import datetime, timedelta, timezone

import pytest

from services.health_service import calculate_cihs

NOW = datetime(2026, 10, 16, 12, 0, tzinfo=timezone.utc)
WEIGHTS = {"electrical": 0.40, "monitoring": 0.20, "board": 0.15, "maintenance": 0.25}

ONLINE = [
    {"node_id": "esp32", "kind": "SENSOR_NODE", "state": "ONLINE"},
    {"node_id": "cam", "kind": "CAMERA", "state": "ONLINE"},
]


def ago(hours):
    return (NOW - timedelta(hours=hours)).isoformat()


def room(faults=(), tickets=(), nodes=ONLINE):
    return {"fans_total": 6, "lights_total": 6,
            "faults": list(faults), "tickets": list(tickets), "nodes": list(nodes)}


def fault(kind, hours=0, device_id=None):
    return {"fault_type": kind, "device_id": device_id, "detected_at": ago(hours)}


def ticket(priority, hours=0, status="OPEN", overdue=False, started=False):
    due = ago(1) if overdue else ago(-2)
    return {"priority": priority, "status": status, "created_at": ago(hours),
            "sla_due_at": due, "started_at": ago(0) if started else None}


@pytest.mark.parametrize("name, inputs, score, status", [
    ("healthy", room(), 100.0, "NORMAL"),
    # 1/12 units: 8.33 x .4 = 3.33; HIGH new ticket 40 x .25 = 10
    ("one fan down", room([fault("FAN_FAILURE", device_id=3)], [ticket("HIGH")]), 86.7, "NORMAL"),
    # ticket 24 h old (x2) and overdue (x1.5) -> 120 capped at 100 x .25 = 25
    ("fan down a day, SLA missed",
     room([fault("FAN_FAILURE", 24, 3)], [ticket("HIGH", 24, overdue=True)]), 71.7, "WARNING"),
    # abnormality floor 60 x .4 = 24; HIGH ticket 10
    ("electrical abnormality", room([fault("ELECTRICAL_ABNORMALITY")], [ticket("HIGH")]), 66.0, "WARNING"),
    # board 12 h: 40 + 30 = 70 x .15 = 10.5; LOW 12 h: 15 x .25 = 3.75
    ("board pending 12 h", room([fault("BOARD_NEEDS_CLEANING", 12)], [ticket("LOW", 12)]), 85.8, "NORMAL"),
    ("camera offline",
     room(nodes=[ONLINE[0], {**ONLINE[1], "state": "OFFLINE"}]), 90.0, "NORMAL"),
    # resolved, awaiting verification: x0.5
    ("resolved", room(tickets=[ticket("HIGH", status="RESOLVED", started=True)]), 95.0, "NORMAL"),
    ("no devices registered", room(nodes=[]), 100.0, "NORMAL"),
    ("blind and broken", room(
        [fault("FAN_FAILURE", 1, i) for i in range(4)] + [fault("ELECTRICAL_ABNORMALITY", 1)],
        [ticket("HIGH", 30, overdue=True)] * 3,
        [{**n, "state": "OFFLINE"} for n in ONLINE]), 31.0, "CRITICAL"),
])
def test_cihs(name, inputs, score, status):
    got, got_status, components = calculate_cihs(inputs, now=NOW, weights=WEIGHTS)

    assert got == pytest.approx(score, abs=0.05), name
    assert got_status == status
    assert set(components) == {"electrical", "board", "maintenance", "monitoring"}


def test_components_explain_the_deduction():
    score, _, components = calculate_cihs(
        room([fault("FAN_FAILURE", device_id=1)], [ticket("MEDIUM")]), now=NOW, weights=WEIGHTS)

    assert 100 - sum(c["points"] for c in components.values()) == pytest.approx(score, abs=0.1)
    assert components["electrical"]["faulty_units"] == 1
    assert components["maintenance"]["open_tickets"] == 1
