from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TicketHistoryCreate(BaseModel):
    ticket_id: int
    previous_status: str | None = Field(
        default=None,
        max_length=30
    )
    new_status: str = Field(
        ...,
        min_length=1,
        max_length=30
    )
    changed_by: int | None = None
    note: str | None = None


class TicketHistoryResponse(BaseModel):
    history_id: int
    ticket_id: int
    previous_status: str | None
    new_status: str
    changed_at: datetime
    changed_by: int | None
    note: str | None

    model_config = ConfigDict(from_attributes=True)