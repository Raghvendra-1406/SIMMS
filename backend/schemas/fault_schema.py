from typing import Any
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FaultEventCreate(BaseModel):
    room_id: int
    device_id: int | None = None
    fault_type: str = Field(..., min_length=1, max_length=40)
    detected_at: datetime
    confidence: float | None = Field(default=None, ge=0, le=100)
    abnormal_count: int | None = Field(default=None, ge=1)


class FaultStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=30)


class FaultEventResponse(BaseModel):
    fault_id: int
    room_id: int
    device_id: int | None
    # "Fan 2" / "Camera"; None for room-level faults
    device_name: str | None = None
    fault_type: str
    detected_at: datetime
    confirmed_at: datetime | None
    status: str
    confidence: float | None
    abnormal_count: int | None
    created_at: datetime
    # What the detector saw when it confirmed the fault
    # (only on GET /faults/{fault_id}).
    details: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)