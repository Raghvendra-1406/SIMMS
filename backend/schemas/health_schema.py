from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HealthScoreCreate(BaseModel):
    room_id: int
    health_status: str = Field(
        ...,
        min_length=1,
        max_length=20
    )
    health_score: float | None = Field(
        default=None,
        ge=0,
        le=100
    )
    active_fault_count: int = Field(
        default=0,
        ge=0
    )
    occupancy_count: int = Field(
        default=0,
        ge=0
    )
    temperature: float | None = None
    humidity: float | None = Field(
        default=None,
        ge=0,
        le=100
    )
    power: float | None = Field(
        default=None,
        ge=0
    )


class HealthScoreResponse(BaseModel):
    health_id: int
    room_id: int
    health_status: str
    health_score: float | None
    active_fault_count: int
    occupancy_count: int
    temperature: float | None
    humidity: float | None
    power: float | None
    calculated_at: datetime

    model_config = ConfigDict(from_attributes=True)