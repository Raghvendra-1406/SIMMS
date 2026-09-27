from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RoomCreate(BaseModel):
    room_name: str = Field(..., min_length=1, max_length=20)
    room_type: str = Field(..., min_length=1, max_length=20)
    building: str | None = Field(default=None, max_length=100)
    floor: int | None = None
    capacity: int | None = Field(default=None, ge=1)
    status: str = Field(default="ACTIVE", min_length=1, max_length=30)


class RoomUpdate(BaseModel):
    room_name: str = Field(..., min_length=1, max_length=20)
    room_type: str = Field(..., min_length=1, max_length=20)
    building: str | None = Field(default=None, max_length=100)
    floor: int | None = None
    capacity: int | None = Field(default=None, ge=1)
    status: str = Field(default="ACTIVE", min_length=1, max_length=30)


class RoomResponse(BaseModel):
    room_id: int
    room_name: str
    room_type: str
    building: str | None
    floor: int | None
    capacity: int | None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)