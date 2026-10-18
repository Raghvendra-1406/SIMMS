"""
Web Push notifications (Plan v2 C8, T16).

Every in-app notification is also pushed to the user's subscribed
browsers / installed app, so it reaches a locked phone with the
browser closed. Sending happens on a small background pool: it never
slows the MQTT worker or an API request, and a push failure never
affects the ticket.

Subscriptions the push service reports as gone (404 / 410) are
deleted. Without VAPID keys configured, push is simply off.
"""

import json
from concurrent.futures import ThreadPoolExecutor

from config.settings import (
    VAPID_PRIVATE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_SUBJECT,
)

from database.repositories.push_repository import (
    delete_subscription,
    get_user_subscriptions,
    mark_subscription_result,
)

from database.repositories.user_repository import get_user_by_id


# Title per notification type; the message is the body.
TITLES = {
    "TICKET_CREATED": "New ticket",
    "TICKET_ASSIGNED": "Ticket assigned to you",
    "TICKET_REOPENED": "Ticket reopened",
    "TICKET_ESCALATED": "Ticket escalated",
    "TICKET_AUTO_RESOLVED": "Ticket closed automatically",
    "SLA_BREACHED": "Response time missed",
    "TEST": "SIMMS test notification",
}

# Delivered promptly even on a phone in power-saving mode.
URGENT_TYPES = {"SLA_BREACHED", "TICKET_ESCALATED", "TICKET_ASSIGNED", "TEST"}

TICKET_PATHS = {
    "SUPERVISOR": "/supervisor/tickets/{id}",
    "MAINTENANCE_STAFF": "/maintenance/tickets/{id}",
}

HOME_PATHS = {
    "SUPERVISOR": "/supervisor/notifications",
    "MAINTENANCE_STAFF": "/maintenance/notifications",
    "ADMIN": "/admin/dashboard",
}

# Kept by the push service for up to 12 h if the phone is offline.
TTL_SECONDS = 12 * 3600

_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="push")


def log(message):
    print(f"[push] {message}", flush=True)


def is_configured():
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


def public_key():
    return VAPID_PUBLIC_KEY or None


def build_payload(user_id, notification_type, message, ticket_id=None):
    user = get_user_by_id(user_id)
    role = user[4] if user else None

    if ticket_id is not None and role in TICKET_PATHS:
        url = TICKET_PATHS[role].format(id=ticket_id)
    else:
        url = HOME_PATHS.get(role, "/")

    return {
        "title": TITLES.get(notification_type, "SIMMS"),
        "body": message,
        "url": url,
        # One notification per ticket on the device: a newer event for
        # the same ticket replaces the older one instead of stacking.
        "tag": f"ticket-{ticket_id}" if ticket_id is not None else notification_type,
        "type": notification_type,
    }


def _send(subscription, payload, urgent):
    # Imported lazily: only needed when push is configured.
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": {
                    "p256dh": subscription["p256dh"],
                    "auth": subscription["auth"],
                },
            },
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=TTL_SECONDS,
            headers={"Urgency": "high" if urgent else "normal"},
            timeout=10,
        )

        mark_subscription_result(subscription["subscription_id"])

        return True

    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)

        if status in (404, 410):
            # Unsubscribed / expired in the browser: forget it.
            delete_subscription(subscription["endpoint"])
            log(f"Removed expired subscription {subscription['subscription_id']}.")
        else:
            mark_subscription_result(subscription["subscription_id"], exc)
            log(f"Push failed ({status}): {exc}")

        return False

    except Exception as exc:
        mark_subscription_result(subscription["subscription_id"], exc)
        log(f"Push failed: {exc!r}")

        return False


def send_to_user(user_id, notification_type, message, ticket_id=None):
    """
    Push synchronously to every subscription of the user.
    Returns the number delivered to the push service.
    """

    if not is_configured():
        return 0

    subscriptions = get_user_subscriptions(user_id)

    if not subscriptions:
        return 0

    payload = build_payload(user_id, notification_type, message, ticket_id)
    urgent = notification_type in URGENT_TYPES

    return sum(_send(s, payload, urgent) for s in subscriptions)


def queue_push(user_id, notification_type, message, ticket_id=None):
    """
    Fire-and-forget push for a new in-app notification.
    """

    if not is_configured():
        return

    def job():
        try:
            send_to_user(user_id, notification_type, message, ticket_id)
        except Exception as exc:
            log(f"Push job failed for user {user_id}: {exc!r}")

    _pool.submit(job)
