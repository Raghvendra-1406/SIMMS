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
    fault_type: str
    detected_at: datetime
    confirmed_at: datetime | None
    status: str
    confidence: float | None
    abnormal_count: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)