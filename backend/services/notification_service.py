from database.repositories.notification_repository import (
    create_notification,
    get_notification_by_id,
    get_notifications_by_user,
    get_unread_notifications,
    mark_notification_as_read,
    mark_all_notifications_as_read,
)


def create_system_notification(
    user_id,
    notification_type,
    message,
    ticket_id=None
):
    if user_id is None:
        raise ValueError("User ID is required.")

    if not notification_type:
        raise ValueError(
            "Notification type is required."
        )

    if not message or not message.strip():
        raise ValueError(
            "Notification message is required."
        )

    return create_notification(
        user_id=user_id,
        notification_type=notification_type,
        message=message.strip(),
        ticket_id=ticket_id
    )


def get_user_notifications(user_id):
    if user_id is None:
        raise ValueError("User ID is required.")

    return get_notifications_by_user(user_id)


def get_user_unread_notifications(user_id):
    if user_id is None:
        raise ValueError("User ID is required.")

    return get_unread_notifications(user_id)


def get_user_notification(
    notification_id,
    user_id
):
    notification = get_notification_by_id(
        notification_id
    )

    if notification is None:
        raise ValueError(
            "Notification not found."
        )

    if notification[1] != user_id:
        raise ValueError(
            "Notification does not belong to the current user."
        )

    return notification


def mark_user_notification_as_read(
    notification_id,
    user_id
):
    notification = get_user_notification(
        notification_id=notification_id,
        user_id=user_id
    )

    if notification[5]:
        return notification

    updated_notification = mark_notification_as_read(
        notification_id
    )

    if updated_notification is None:
        raise ValueError(
            "Notification could not be marked as read."
        )

    return updated_notification


def mark_user_notifications_as_read(user_id):
    if user_id is None:
        raise ValueError("User ID is required.")

    notifications = mark_all_notifications_as_read(
        user_id
    )

    return len(notifications)


