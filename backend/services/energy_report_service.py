"""
Energy wasted in empty classrooms (Plan v2 C5, §16 results).

For each room, the LIGHTS + FANS circuit power is integrated over the
period, reading to reading (left Riemann sum, ~10 s steps). Each step is
classified by the camera's occupancy at that moment:

- OCCUPIED  people present, or the room emptied less than
            VACANCY_MINUTES ago (same grace as the Energy wastage fault:
            someone stepping out is not waste)
- WASTED    the room has been empty for at least VACANCY_MINUTES
- UNKNOWN   no recent occupancy count (camera offline / not installed)

Steps longer than ENERGY_MAX_GAP_SECONDS (meter offline) are not
integrated at all; their duration is reported as a gap. Nothing is
guessed: unknown energy is shown separately, never counted as waste.

The MAIN circuit is not used: sockets (projector, chargers) are not
lights or fans left on.
"""

from bisect import bisect_right
from datetime import datetime, timedelta, timezone

from config.settings import (
    CURRENCY_SYMBOL,
    ENERGY_MAX_GAP_SECONDS,
    GRID_EMISSION_KG_PER_KWH,
    OCCUPANCY_MAX_AGE_MINUTES,
    TARIFF_PER_KWH,
    VACANCY_MINUTES,
)

from database.connection import get_connection

from services.stats_service import resolve_period


OCCUPIED = "OCCUPIED"
WASTED = "WASTED"
UNKNOWN = "UNKNOWN"

# A waste stretch shorter than this is not listed as an event.
MIN_EVENT_MINUTES = 5

TOP_EVENTS = 8


ROOMS_SQL = """
SELECT room_id, room_name
FROM rooms
WHERE status = 'ACTIVE'
  AND (%(room_id)s::int IS NULL OR room_id = %(room_id)s)
ORDER BY room_name
"""

# Power per circuit; readings without circuit data (older firmware)
# carry no per-circuit power and are skipped.
ELECTRICAL_SQL = """
SELECT
    room_id,
    observed_at,
    COALESCE((observation_data #>> '{circuits,LIGHTS,power}')::float, 0) AS lights_w,
    COALESCE((observation_data #>> '{circuits,FANS,power}')::float, 0) AS fans_w
FROM sensor_observations
WHERE observation_type = 'ELECTRICAL'
  AND observation_data ? 'circuits'
  AND observed_at >= %(start)s
  AND observed_at < %(end)s
  AND room_id = ANY(%(room_ids)s)
ORDER BY room_id, observed_at
"""

# From earlier than the period so vacancy at its start is known.
OCCUPANCY_SQL = """
SELECT
    room_id,
    observed_at,
    (observation_data->>'occupancy_count')::int AS people
FROM vision_observations
WHERE observation_type = 'OCCUPANCY'
  AND observed_at >= %(lookback)s
  AND observed_at < %(end)s
  AND room_id = ANY(%(room_ids)s)
  AND observation_data ? 'occupancy_count'
ORDER BY room_id, observed_at
"""


def _fetch(sql, params):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(sql, params)
        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def _group(rows):
    grouped = {}

    for row in rows:
        grouped.setdefault(row[0], []).append(row[1:])

    return grouped


class OccupancyTimeline:
    """
    State at any time t, from the room's occupancy readings in order.
    Precomputes for each reading when the current empty stretch began.
    """

    def __init__(self, readings):
        max_age = timedelta(minutes=OCCUPANCY_MAX_AGE_MINUTES)

        self.times = []
        self.people = []
        self.vacant_since = []

        since = None
        previous = None

        for observed_at, people in readings:
            # A camera gap breaks the empty stretch: we don't know
            # whether someone came in meanwhile.
            if previous is not None and observed_at - previous > max_age:
                since = None

            if people is None or people > 0:
                since = None
            elif since is None:
                since = observed_at

            self.times.append(observed_at)
            self.people.append(people)
            self.vacant_since.append(since)

            previous = observed_at

        self.max_age = max_age
        self.grace = timedelta(minutes=VACANCY_MINUTES)

    def state(self, t):
        index = bisect_right(self.times, t) - 1

        if index < 0 or t - self.times[index] > self.max_age:
            return UNKNOWN

        people = self.people[index]

        if people is None:
            return UNKNOWN

        if people > 0:
            return OCCUPIED

        since = self.vacant_since[index]

        if since is not None and t - since >= self.grace:
            return WASTED

        return OCCUPIED  # empty, but still within the grace period


def _empty_totals():
    return {
        "total_kwh": 0.0,
        "occupied_kwh": 0.0,
        "wasted_kwh": 0.0,
        "unknown_kwh": 0.0,
        "wasted_lights_kwh": 0.0,
        "wasted_fans_kwh": 0.0,
        "wasted_hours": 0.0,
        "monitored_hours": 0.0,
        "gap_hours": 0.0,
    }


def _finish(totals):
    known = totals["occupied_kwh"] + totals["wasted_kwh"]

    totals["wasted_share"] = totals["wasted_kwh"] / known if known else None
    totals["wasted_cost"] = totals["wasted_kwh"] * TARIFF_PER_KWH
    totals["wasted_co2_kg"] = totals["wasted_kwh"] * GRID_EMISSION_KG_PER_KWH

    return totals


def analyse_room(electrical, timeline, end, shift, daily, events, room):
    """
    Integrate one room's readings; adds to daily / events in place.
    """

    totals = _empty_totals()
    max_gap = ENERGY_MAX_GAP_SECONDS

    event = None

    def close_event():
        if event and (event["end"] - event["start"]) >= timedelta(minutes=MIN_EVENT_MINUTES):
            events.append({**event, "room_id": room[0], "room_name": room[1]})

    for i, (observed_at, lights_w, fans_w) in enumerate(electrical):
        following = electrical[i + 1][0] if i + 1 < len(electrical) else end
        seconds = (following - observed_at).total_seconds()

        if seconds <= 0:
            continue

        if seconds > max_gap:
            totals["gap_hours"] += seconds / 3600
            close_event()
            event = None
            continue

        hours = seconds / 3600
        lights_kwh = lights_w * hours / 1000
        fans_kwh = fans_w * hours / 1000
        kwh = lights_kwh + fans_kwh

        state = timeline.state(observed_at)

        totals["monitored_hours"] += hours
        totals["total_kwh"] += kwh

        day = daily.setdefault(
            (observed_at + shift).date(),
            {"occupied_kwh": 0.0, "wasted_kwh": 0.0, "unknown_kwh": 0.0},
        )

        if state == WASTED:
            totals["wasted_kwh"] += kwh
            totals["wasted_lights_kwh"] += lights_kwh
            totals["wasted_fans_kwh"] += fans_kwh
            day["wasted_kwh"] += kwh

            if kwh > 0:
                totals["wasted_hours"] += hours

                if event is None:
                    event = {"start": observed_at, "end": following, "kwh": 0.0,
                             "lights_kwh": 0.0, "fans_kwh": 0.0}

                event["end"] = following
                event["kwh"] += kwh
                event["lights_kwh"] += lights_kwh
                event["fans_kwh"] += fans_kwh
            else:
                close_event()
                event = None

        else:
            close_event()
            event = None

            if state == OCCUPIED:
                totals["occupied_kwh"] += kwh
                day["occupied_kwh"] += kwh
            else:
                totals["unknown_kwh"] += kwh
                day["unknown_kwh"] += kwh

    close_event()

    return _finish(totals)


def get_energy_report(days=7, start=None, end=None, room_id=None,
                      tz_offset_minutes=0):
    start, end = resolve_period(days=days, start=start, end=end)

    rooms = _fetch(ROOMS_SQL, {"room_id": room_id})
    room_ids = [room[0] for room in rooms] or [-1]

    electrical = _group(_fetch(ELECTRICAL_SQL, {
        "start": start, "end": end, "room_ids": room_ids,
    }))

    lookback = start - timedelta(minutes=VACANCY_MINUTES + OCCUPANCY_MAX_AGE_MINUTES + 60)

    occupancy = _group(_fetch(OCCUPANCY_SQL, {
        "lookback": lookback, "end": end, "room_ids": room_ids,
    }))

    # Same convention as the ticket statistics (JS getTimezoneOffset).
    shift = timedelta(minutes=-tz_offset_minutes)

    daily = {}
    events = []
    per_room = []
    overall = _empty_totals()

    for room in rooms:
        totals = analyse_room(
            electrical.get(room[0], []),
            OccupancyTimeline(occupancy.get(room[0], [])),
            end, shift, daily, events, room,
        )

        per_room.append({"room_id": room[0], "room_name": room[1], **totals})

        for key in overall:
            overall[key] += totals[key]

    first_day = (start + shift).date()
    last_day = (end + shift).date()

    series = []
    current = first_day

    while current <= last_day:
        day = daily.get(current, {"occupied_kwh": 0.0, "wasted_kwh": 0.0, "unknown_kwh": 0.0})
        series.append({"date": current.isoformat(), **day})
        current += timedelta(days=1)

    events.sort(key=lambda e: -e["kwh"])

    for event in events:
        event["minutes"] = (event["end"] - event["start"]).total_seconds() / 60

    return {
        "period": {
            "start": start,
            "end": end,
            "days": (end - start).total_seconds() / 86400,
            "rooms": len(rooms),
        },
        "assumptions": {
            "tariff_per_kwh": TARIFF_PER_KWH,
            "currency": CURRENCY_SYMBOL,
            "emission_kg_per_kwh": GRID_EMISSION_KG_PER_KWH,
            "vacancy_minutes": VACANCY_MINUTES,
            "max_gap_seconds": ENERGY_MAX_GAP_SECONDS,
            "occupancy_max_age_minutes": OCCUPANCY_MAX_AGE_MINUTES,
        },
        "totals": _finish(overall),
        "rooms": per_room,
        "daily": series,
        "top_events": events[:TOP_EVENTS],
        "generated_at": datetime.now(timezone.utc),
    }
