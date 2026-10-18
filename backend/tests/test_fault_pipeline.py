"""MQTT reading -> rule -> 4-of-5 confirmation -> fault + ticket (Plan v2 §7)."""

import pytest

import mqtt.subscriber as sub
from services.fault_processing_service import handle_confirmed_fault
from services.ticket_service import change_ticket_status


@pytest.fixture(autouse=True)
def quiet(monkeypatch):
    monkeypatch.setattr(sub, "log", lambda message: None)


def reading(volts=230.0, fans_amps=0.0, lights_amps=0.0):
    return {
        "node_id": "esp32-R1", "device_name": "ESP32 Node", "voltage": volts,
        "circuits": {
            "LIGHTS": {"current": lights_amps, "power": lights_amps * volts, "power_factor": 0.95, "energy": 1.0},
            "FANS": {"current": fans_amps, "power": fans_amps * volts * 0.9, "power_factor": 0.9, "energy": 1.0},
        },
    }


def send(room, payload, times=1):
    for _ in range(times):
        sub.process_sensor_message((room["room_id"], room["name"]), payload)


def tickets(sql):
    return sql("""
        select t.ticket_id, t.status, t.priority, f.fault_type, f.device_id,
               t.assigned_to, t.recurrence_count, f.detected_at <= f.confirmed_at
        from tickets t join fault_events f using (fault_id) order by t.ticket_id
    """)


def test_single_blip_raises_nothing(room, users, sql):
    send(room, reading(volts=262))
    send(room, reading(), times=4)

    assert tickets(sql) == []


def test_persistent_overvoltage_raises_exactly_one_routed_ticket(room, users, sql):
    send(room, reading(volts=262), times=4)
    assert tickets(sql) == [], "3 of 4 so far: not yet confirmed"

    send(room, reading(volts=262), times=8)

    rows = tickets(sql)
    assert len(rows) == 1
    _, status, priority, fault_type, _, assigned_to, _, onset_first = rows[0]
    assert (status, priority, fault_type) == ("OPEN", "HIGH", "ELECTRICAL_ABNORMALITY")
    assert assigned_to == users["electrician"]["user_id"]
    assert onset_first


def test_fault_that_clears_untouched_is_auto_resolved(room, users, sql):
    send(room, reading(volts=262), times=5)
    send(room, reading(), times=3)

    assert tickets(sql)[0][1] == "AUTO_RESOLVED"


def test_started_ticket_is_not_auto_resolved(room, users, sql, client, auth):
    send(room, reading(volts=262), times=5)
    ticket_id = tickets(sql)[0][0]

    assert client.post(f"/tickets/{ticket_id}/start", headers=auth(users["electrician"])).status_code == 200

    send(room, reading(), times=3)
    assert tickets(sql)[0][1] == "OPEN"


def test_closed_fault_is_suppressed_during_cooldown(room, users, sql):
    first = handle_confirmed_fault("BOARD_NEEDS_CLEANING", room["room_id"], None, 4)
    ticket_id = first["ticket"][0]

    change_ticket_status(ticket_id, "RESOLVED")
    change_ticket_status(ticket_id, "CLOSED")

    again = handle_confirmed_fault("BOARD_NEEDS_CLEANING", room["room_id"], None, 4)
    assert again["action"] == "COOLDOWN"
    assert len(tickets(sql)) == 1


def test_recurrence_after_repair_reopens_the_same_ticket(room, users, sql):
    first = handle_confirmed_fault("ELECTRICAL_ABNORMALITY", room["room_id"], None, 4)
    ticket_id = first["ticket"][0]
    change_ticket_status(ticket_id, "RESOLVED")

    again = handle_confirmed_fault("ELECTRICAL_ABNORMALITY", room["room_id"], None, 4)

    assert again["action"] == "REOPENED"
    rows = tickets(sql)
    assert len(rows) == 1 and rows[0][1] == "REOPENED" and rows[0][6] == 1


def test_camera_and_circuit_pinpoint_the_failed_fan(room, users, sql):
    fan3 = room["devices"]["Fan 3"]

    # Six fans drawing current (6 x 0.30 A default), camera sees Fan 3 still.
    batch = {
        "node_id": "camera-R1",
        "fans": [
            {"device_name": f"Fan {n}", "running": n != 3, "motion_score": 0.0 if n == 3 else 0.4, "confidence": 0.95}
            for n in range(1, 7)
        ],
    }

    for _ in range(5):
        send(room, reading(fans_amps=1.8))
        sub.process_vision_message((room["room_id"], room["name"]), batch)

    rows = [r for r in tickets(sql) if r[3] == "FAN_FAILURE"]
    assert len(rows) == 1
    assert rows[0][4] == fan3
    assert rows[0][2] == "HIGH"
