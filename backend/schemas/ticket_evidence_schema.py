from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TicketEvidenceCreate(BaseModel):
    ticket_id: int
    evidence_type: str = Field(
        ...,
        min_length=1,
        max_length=30
    )
    evidence_data: dict[str, Any] | None = None
    evidence_stage: str = Field(
        ...,
        min_length=1,
        max_length=30
    )


class TicketEvidenceResponse(BaseModel):
    evidence_id: int
    ticket_id: int
    evidence_type: str
    evidence_data: dict[str, Any] | None
    captured_at: datetime
    evidence_stage: str

    model_config = ConfigDict(from_attributes=True)