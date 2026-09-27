from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeviceCreate(BaseModel):
    room_id: int
    device_type: str = Field(..., min_length=1, max_length=30)
    device_name: str = Field(..., min_length=1, max_length=100)
    status: str = Field(default="ACTIVE", min_length=1, max_length=30)


class DeviceUpdate(BaseModel):
    room_id: int
    device_type: str = Field(..., min_length=1, max_length=30)
    device_name: str = Field(..., min_length=1, max_length=100)
    status: str = Field(default="ACTIVE", min_length=1, max_length=30)


class DeviceStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=30)


class DeviceResponse(BaseModel):
    device_id: int
    room_id: int
    device_type: str
    device_name: str
    status: str
    last_seen: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)