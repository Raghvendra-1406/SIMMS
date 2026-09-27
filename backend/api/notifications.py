from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth_dependencies import (
    get_current_user,
)

from schemas.notification_schema import (
    NotificationResponse,
)

from services.notification_service import (
    get_user_notifications,
    get_user_unread_notifications,
    get_user_notification,
    mark_user_notification_as_read,
    mark_user_notifications_as_read,
)


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


def require_supervisor(current_user):
    if current_user["role"] != "SUPERVISOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors can access notifications."
        )

    return current_user


def notification_to_response(notification):
    return {
        "notification_id": notification[0],
        "user_id": notification[1],
        "ticket_id": notification[2],
        "notification_type": notification[3],
        "message": notification[4],
        "is_read": notification[5],
        "created_at": notification[6],
    }


# ---------------------------------------------------------
# GET ALL NOTIFICATIONS FOR CURRENT SUPERVISOR
# ---------------------------------------------------------

@router.get(
    "",
    response_model=list[NotificationResponse]
)
def get_notifications_endpoint(
    current_user=Depends(get_current_user)
):
    require_supervisor(current_user)

    try:
        notifications = get_user_notifications(
            current_user["user_id"]
        )

        return [
            notification_to_response(notification)
            for notification in notifications
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


# ---------------------------------------------------------
# GET UNREAD NOTIFICATIONS
# ---------------------------------------------------------

@router.get(
    "/unread",
    response_model=list[NotificationResponse]
)
def get_unread_notifications_endpoint(
    current_user=Depends(get_current_user)
):
    require_supervisor(current_user)

    try:
        notifications = get_user_unread_notifications(
            current_user["user_id"]
        )

        return [
            notification_to_response(notification)
            for notification in notifications
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


# ---------------------------------------------------------
# GET INDIVIDUAL NOTIFICATION
# ---------------------------------------------------------

@router.get(
    "/{notification_id}",
    response_model=NotificationResponse
)
def get_notification_endpoint(
    notification_id: int,
    current_user=Depends(get_current_user)
):
    require_supervisor(current_user)

    try:
        notification = get_user_notification(
            notification_id=notification_id,
            user_id=current_user["user_id"]
        )

        return notification_to_response(
            notification
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


# ---------------------------------------------------------
# MARK ALL NOTIFICATIONS AS READ
# ---------------------------------------------------------

@router.patch(
    "/read-all"
)
def mark_all_notifications_read_endpoint(
    current_user=Depends(get_current_user)
):
    require_supervisor(current_user)

    try:
        updated_count = (
            mark_user_notifications_as_read(
                current_user["user_id"]
            )
        )

        return {
            "message": "All notifications marked as read.",
            "updated_count": updated_count
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


# ---------------------------------------------------------
# MARK INDIVIDUAL NOTIFICATION AS READ
# ---------------------------------------------------------

@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse
)
def mark_notification_read_endpoint(
    notification_id: int,
    current_user=Depends(get_current_user)
):
    require_supervisor(current_user)

    try:
        notification = mark_user_notification_as_read(
            notification_id=notification_id,
            user_id=current_user["user_id"]
        )

        return notification_to_response(
            notification
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )