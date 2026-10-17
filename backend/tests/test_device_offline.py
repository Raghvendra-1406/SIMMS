"""Device offline faults (Plan v2 §16 T13 / T17)."""

import pytest

from services.device_health_service import check_offline_devices
from services.fault_conditions import current_condition


@pytest.fixture
def camera_offline(room, sql):
    def set_offline(minutes):
        sql("delete from node_status")
        sql("""insert into node_status (room_id, node_id, kind, state, last_seen)
               values (%s, 'camera-R1', 'CAMERA', 'OFFLINE', now() - %s * interval '1 minute')""",
            (room["room_id"], minutes))

    return set_offline


def faults(sql):
    return sql("""select f.fault_type, f.device_id, t.status, t.priority, t.category,
                         f.detected_at < f.confirmed_at - interval '5 minutes'
                  from fault_events f join tickets t using (fault_id)""")


def test_short_outage_raises_nothing(camera_offline, users, sql):
    camera_offline(2)
    assert check_offline_devices() == []
    assert faults(sql) == []


def test_long_outage_raises_one_medium_infrastructure_ticket(camera_offline, room, users, sql):
    camera_offline(7)

    assert check_offline_devices() == [("CREATED", "camera-R1")]
    assert check_offline_devices() == []

    fault_type, device_id, status, priority, category, onset_first = faults(sql)[0]
    assert (fault_type, device_id) == ("DEVICE_OFFLINE", room["devices"]["Camera"])
    assert (status, priority, category) == ("OPEN", "MEDIUM", "INFRASTRUCTURE")
    assert onset_first, "detected_at is when the device went quiet"


def test_back_online_auto_resolves(camera_offline, room, users, sql):
    camera_offline(7)
    check_offline_devices()

    camera = room["devices"]["Camera"]
    assert current_condition("DEVICE_OFFLINE", room["room_id"], camera)[0] is True

    sql("update node_status set state = 'ONLINE', last_seen = now()")

    assert current_condition("DEVICE_OFFLINE", room["room_id"], camera)[0] is False
    assert check_offline_devices() == [("AUTO_RESOLVED", "camera-R1")]
    assert faults(sql)[0][2] == "AUTO_RESOLVED"
