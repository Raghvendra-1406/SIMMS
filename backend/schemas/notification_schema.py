from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NotificationCreate(BaseModel):
    user_id: int
    ticket_id: int | None = None
    notification_type: str = Field(
        ...,
        min_length=1,
        max_length=40
    )
    message: str = Field(
        ...,
        min_length=1
    )


class NotificationResponse(BaseModel):
    notification_id: int
    user_id: int
    ticket_id: int | None
    notification_type: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationReadUpdate(BaseModel):
    is_read: bool