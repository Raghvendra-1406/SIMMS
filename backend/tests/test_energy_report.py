"""Energy wasted in empty rooms: integration and classification."""

from datetime import datetime, timedelta, timezone

import pytest

import services.energy_report_service as er

T0 = datetime(2026, 10, 15, 4, 0, tzinfo=timezone.utc)
END = T0 + timedelta(minutes=60)


def at(minutes):
    return T0 + timedelta(minutes=minutes)


# One hour, a reading every 10 s: lights 100 W + fans 200 W.
READINGS = [(at(s / 60), 100.0, 200.0) for s in range(0, 3600, 10)]

# People for 20 min, then empty (waste from 30 min: 10 min grace).
OCCUPANCY = [(at(s / 60), 5 if s < 1200 else 0) for s in range(0, 3600, 30)]


def analyse(readings=READINGS, occupancy=OCCUPANCY, shift=timedelta(0)):
    daily, events = {}, []
    totals = er.analyse_room(readings, er.OccupancyTimeline(occupancy), END, shift,
                             daily, events, (1, "R1"))
    return totals, daily, events


def test_waste_counts_after_the_grace_period():
    totals, _, events = analyse()

    assert totals["total_kwh"] == pytest.approx(0.3)
    assert totals["wasted_kwh"] == pytest.approx(0.15)
    assert totals["occupied_kwh"] == pytest.approx(0.15)
    assert totals["wasted_lights_kwh"] == pytest.approx(0.05)
    assert totals["wasted_fans_kwh"] == pytest.approx(0.10)
    assert totals["wasted_share"] == pytest.approx(0.5)
    assert totals["wasted_cost"] == pytest.approx(0.15 * er.TARIFF_PER_KWH)
    assert len(events) == 1 and events[0]["kwh"] == pytest.approx(0.15)


def test_daily_buckets_use_the_local_date():
    _, daily, _ = analyse(shift=timedelta(minutes=330))
    assert list(daily) == [(T0 + timedelta(minutes=330)).date()]


def test_stale_camera_is_unknown_not_waste():
    totals, _, _ = analyse(occupancy=[o for o in OCCUPANCY if o[0] < at(30)])

    assert totals["unknown_kwh"] > 0.12
    assert totals["wasted_kwh"] < 0.03


def test_meter_gap_is_reported_not_integrated():
    gapped = [r for r in READINGS if not (at(10) <= r[0] < at(30))]
    totals, _, _ = analyse(readings=gapped)

    assert totals["gap_hours"] == pytest.approx(20 / 60 + 10 / 3600, abs=1e-3)
    assert totals["total_kwh"] < 0.21


def test_nothing_on_is_no_waste():
    totals, _, events = analyse(readings=[(t, 0.0, 0.0) for t, _, _ in READINGS])
    assert totals["wasted_kwh"] == 0 and events == []


def test_report_endpoint(client, auth, users, room):
    response = client.get("/stats/energy?days=1", headers=auth(users["supervisor"]))

    assert response.status_code == 200
    assert response.json()["rooms"][0]["room_name"] == "R1"
    assert client.get("/stats/energy", headers=auth(users["electrician"])).status_code == 403
