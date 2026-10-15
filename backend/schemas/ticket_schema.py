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


class TicketAssign(BaseModel):
    # None unassigns the ticket.
    user_id: int | None = None


class TicketResponse(BaseModel):
    ticket_id: int
    fault_id: int
    priority: str
    status: str
    created_at: datetime
    resolved_at: datetime | None
    closed_at: datetime | None
    maintenance_notes: str | None

    # Routing and SLA (Plan v2 §9)
    category: str | None = None
    assigned_to: int | None = None
    assigned_to_name: str | None = None
    assigned_to_team: str | None = None
    assigned_at: datetime | None = None
    sla_due_at: datetime | None = None
    started_at: datetime | None = None
    escalated_at: datetime | None = None
    # ON_TRACK / DUE_SOON / OVERDUE / MET / LATE
    sla_state: str | None = None

    model_config = ConfigDict(from_attributes=True)