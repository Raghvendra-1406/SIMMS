from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TicketCreate(BaseModel):
    fault_id: int
    priority: str = Field(
        default="MEDIUM",
        min_length=1,
        max_length=20
    )
    status: str = Field(
        default="OPEN",
        min_length=1,
        max_length=30
    )
    maintenance_notes: str | None = None


class TicketStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        min_length=1,
        max_length=30
    )
    maintenance_notes: str | None = None


class TicketPriorityUpdate(BaseModel):
    priority: str = Field(
        ...,
        min_length=1,
        max_length=20
    )


class TicketMaintenanceNotesUpdate(BaseModel):
    maintenance_notes: str | None = None


class TicketResponse(BaseModel):
    ticket_id: int
    fault_id: int
    priority: str
    status: str
    created_at: datetime
    resolved_at: datetime | None
    closed_at: datetime | None
    maintenance_notes: str | None

    model_config = ConfigDict(from_attributes=True)