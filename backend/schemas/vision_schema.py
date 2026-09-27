from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class VisionObservationCreate(BaseModel):
    room_id: int
    device_id: int | None = None
    observed_at: datetime
    observation_type: str = Field(..., min_length=1, max_length=40)
    observation_data: dict[str, Any]


class VisionObservationResponse(BaseModel):
    vision_observation_id: int
    room_id: int
    device_id: int | None
    observed_at: datetime
    observation_type: str
    observation_data: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)