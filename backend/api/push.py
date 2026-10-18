from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from dependencies.auth_dependencies import get_current_user

from database.repositories.push_repository import (
    delete_subscription,
    get_user_subscriptions,
    upsert_subscription,
)

from services.push_service import (
    is_configured,
    public_key,
    send_to_user,
)


router = APIRouter(
    prefix="/push",
    tags=["Web Push"]
)


class SubscriptionKeys(BaseModel):
    p256dh: str = Field(..., min_length=1, max_length=200)
    auth: str = Field(..., min_length=1, max_length=100)


class PushSubscription(BaseModel):
    # The browser's PushSubscription.toJSON()
    endpoint: str = Field(..., min_length=10, max_length=1000)
    keys: SubscriptionKeys
    expirationTime: Optional[float] = None


class PushUnsubscribe(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=1000)


def require_configured():
    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Push notifications are not set up on the server "
                "(VAPID keys missing)."
            )
        )


@router.get("/config")
def push_config(current_user=Depends(get_current_user)):
    """
    Whether push is available and the key the browser subscribes with.
    """

    return {
        "enabled": is_configured(),
        "public_key": public_key(),
        "subscriptions": len(get_user_subscriptions(current_user["user_id"])),
    }


@router.post("/subscriptions", status_code=status.HTTP_201_CREATED)
def subscribe(
    subscription: PushSubscription,
    request: Request,
    current_user=Depends(get_current_user)
):
    require_configured()

    if not subscription.endpoint.startswith("https://"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid push endpoint."
        )

    row = upsert_subscription(
        user_id=current_user["user_id"],
        endpoint=subscription.endpoint,
        p256dh=subscription.keys.p256dh,
        auth=subscription.keys.auth,
        user_agent=(request.headers.get("user-agent") or "")[:300]
    )

    return {"subscription_id": row["subscription_id"]}


@router.delete("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(
    subscription: PushUnsubscribe,
    current_user=Depends(get_current_user)
):
    delete_subscription(subscription.endpoint, current_user["user_id"])


@router.post("/test")
def send_test(current_user=Depends(get_current_user)):
    require_configured()

    delivered = send_to_user(
        current_user["user_id"],
        "TEST",
        "Notifications are working on this device."
    )

    if delivered == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No device of yours could be reached. Enable notifications on this device first."
        )

    return {"delivered": delivered}
