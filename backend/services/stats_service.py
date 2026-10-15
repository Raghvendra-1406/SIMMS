"""
System statistics for evaluation (Plan v2 §16.2).

Measured here, from what the database records:

- false ticket rate: tickets a supervisor marked FALSE_ALARM, per
  classroom per day (target <= 1). Unreviewed tickets are reported
  separately and never counted as either genuine or false.
- confirmation delay: fault onset (first abnormal vote in the window
  that confirmed it) to confirmation. Physical onset is earlier by up
  to one reading interval; timestamped fault injection measures that.
- ticket-to-notification latency (server side: notification row
  created, not delivery to a phone).
- repair and close times, auto-resolved / reopened counts.
- data completeness: share of 5-minute slots holding a reading.

Missed-fault rate and detector accuracy need ground truth from
injected-fault trials and labelled frames; they are not computed here.
"""

from datetime import datetime, timedelta, timezone

from database.repositories.stats_repository import (
    get_period_coverage,
    get_period_tickets,
    get_stats_rooms,
)

from services.fault_types import (
    FAULT_NAMES,
    FAULT_PRIORITIES,
)


SLOT_SECONDS = 300

FALSE_TICKET_TARGET_PER_ROOM_DAY = 1.0

DETECTION_LATENCY_TARGET_SECONDS = 6 * 60

NOTIFICATION_LATENCY_TARGET_SECONDS = 10


def _seconds(later, earlier):
    if later is None or earlier is None:
        return None

    return max((later - earlier).total_seconds(), 0.0)


def _percentile(values, fraction):
    if not values:
        return None

    ordered = sorted(values)
    index = (len(ordered) - 1) * fraction
    low = int(index)
    high = min(low + 1, len(ordered) - 1)

    return ordered[low] + (ordered[high] - ordered[low]) * (index - low)


def _distribution(values):
    values = [v for v in values if v is not None]

    return {
        "count": len(values),
        "median": _percentile(values, 0.5),
        "p90": _percentile(values, 0.9),
        "max": max(values) if values else None,
    }


def _ratio(numerator, denominator):
    return numerator / denominator if denominator else None


def resolve_period(days=7, start=None, end=None):
    end = end or datetime.now(timezone.utc)

    if start is None:
        start = end - timedelta(days=days)

    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    if start >= end:
        raise ValueError("The period start must be before its end.")

    return start, end


def _ticket_summary(ticket):
    return {
        "ticket_id": ticket["ticket_id"],
        "fault_id": ticket["fault_id"],
        "room_id": ticket["room_id"],
        "room_name": ticket["room_name"],
        "fault_type": ticket["fault_type"],
        "fault_name": FAULT_NAMES.get(
            ticket["fault_type"], ticket["fault_type"]
        ),
        "device_name": ticket["device_name"],
        "priority": ticket["priority"],
        "status": ticket["status"],
        "created_at": ticket["created_at"],
        "was_reopened": ticket["was_reopened"],
        "recurrence_count": ticket["recurrence_count"],
        "confirmation_seconds": _seconds(
            ticket["confirmed_at"], ticket["detected_at"]
        ),
        "verdict": ticket["verdict"],
        "review_note": ticket["review_note"],
    }


def _group_counts(tickets, room_days):
    false_alarms = [t for t in tickets if t["verdict"] == "FALSE_ALARM"]
    genuine = [t for t in tickets if t["verdict"] == "GENUINE"]

    return {
        "tickets": len(tickets),
        "genuine": len(genuine),
        "false_alarms": len(false_alarms),
        "unreviewed": len(tickets) - len(genuine) - len(false_alarms),
        "auto_resolved": sum(
            1 for t in tickets if t["status"] == "AUTO_RESOLVED"
        ),
        "reopened": sum(1 for t in tickets if t["was_reopened"]),
        "tickets_per_room_day": _ratio(len(tickets), room_days),
        "false_alarms_per_room_day": _ratio(len(false_alarms), room_days),
    }


def _daily_series(tickets, start, end, tz_offset_minutes):
    # tz_offset_minutes follows JavaScript getTimezoneOffset():
    # minutes to add to local time to get UTC (IST = -330).
    shift = timedelta(minutes=-tz_offset_minutes)

    first = (start + shift).date()
    last = (end + shift).date()

    days = {}
    current = first

    while current <= last:
        days[current] = {"tickets": 0, "false_alarms": 0}
        current += timedelta(days=1)

    for ticket in tickets:
        day = (ticket["created_at"] + shift).date()

        if day in days:
            days[day]["tickets"] += 1

            if ticket["verdict"] == "FALSE_ALARM":
                days[day]["false_alarms"] += 1

    return [
        {"date": day.isoformat(), **counts}
        for day, counts in days.items()
    ]


def _coverage(rows, rooms, start, end):
    total_slots = max(
        int((end - start).total_seconds() // SLOT_SECONDS),
        1
    )

    by_room = {
        room["room_id"]: {
            "room_id": room["room_id"],
            "room_name": room["room_name"],
            "total_slots": total_slots,
            "sensor": None,
            "vision": None,
        }
        for room in rooms
    }

    for row in rows:
        entry = by_room.get(row["room_id"])

        if entry is None:
            continue

        entry[row["source"]] = {
            "readings": row["readings"],
            "slots": row["slots"],
            "coverage": min(row["slots"] / total_slots, 1.0),
            "first_at": row["first_at"],
            "last_at": row["last_at"],
        }

    return list(by_room.values())


def get_overview(days=7, start=None, end=None, room_id=None,
                 tz_offset_minutes=0):
    start, end = resolve_period(days=days, start=start, end=end)

    rooms = get_stats_rooms(room_id=room_id)
    tickets = get_period_tickets(start, end, room_id=room_id)
    coverage = get_period_coverage(start, end, room_id=room_id)

    period_days = (end - start).total_seconds() / 86400
    room_days = len(rooms) * period_days

    summary = _group_counts(tickets, room_days)

    # Rate over reviewed tickets only: an honest estimate of how many
    # of the unreviewed tickets are likely false too.
    reviewed = summary["genuine"] + summary["false_alarms"]
    summary["false_alarm_share"] = _ratio(
        summary["false_alarms"], reviewed
    )
    summary["review_progress"] = _ratio(reviewed, len(tickets))
    summary["recurrences"] = sum(t["recurrence_count"] for t in tickets)

    confirmation = _distribution([
        _seconds(t["confirmed_at"], t["detected_at"]) for t in tickets
    ])

    notification = _distribution([
        _seconds(t["first_notified_at"], t["created_at"]) for t in tickets
    ])

    by_type = []

    for fault_type in sorted({t["fault_type"] for t in tickets}):
        group = [t for t in tickets if t["fault_type"] == fault_type]

        by_type.append({
            "fault_type": fault_type,
            "fault_name": FAULT_NAMES.get(fault_type, fault_type),
            "priority": FAULT_PRIORITIES.get(fault_type),
            **_group_counts(group, room_days),
            "confirmation_median_seconds": _distribution([
                _seconds(t["confirmed_at"], t["detected_at"])
                for t in group
            ])["median"],
        })

    by_type.sort(key=lambda row: -row["tickets"])

    by_room = []

    for room in rooms:
        group = [t for t in tickets if t["room_id"] == room["room_id"]]

        by_room.append({
            "room_id": room["room_id"],
            "room_name": room["room_name"],
            **_group_counts(group, period_days),
        })

    return {
        "period": {
            "start": start,
            "end": end,
            "days": period_days,
            "rooms": len(rooms),
            "room_days": room_days,
        },
        "targets": {
            "false_alarms_per_room_day": FALSE_TICKET_TARGET_PER_ROOM_DAY,
            "detection_latency_seconds": DETECTION_LATENCY_TARGET_SECONDS,
            "notification_latency_seconds":
                NOTIFICATION_LATENCY_TARGET_SECONDS,
        },
        "summary": summary,
        "latency": {
            "confirmation": confirmation,
            "notification": notification,
            "repair": _distribution([
                _seconds(t["resolved_at"], t["created_at"])
                for t in tickets
            ]),
            "close": _distribution([
                _seconds(t["closed_at"], t["created_at"])
                for t in tickets
                if t["status"] == "CLOSED"
            ]),
        },
        "by_type": by_type,
        "by_room": by_room,
        "daily": _daily_series(tickets, start, end, tz_offset_minutes),
        "coverage": _coverage(coverage, rooms, start, end),
        "tickets": [_ticket_summary(t) for t in tickets[:300]],
    }
