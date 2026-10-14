from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RoomCreate(BaseModel):
    room_name: str = Field(..., min_length=1, max_length=20)
    room_type: str = Field(..., min_length=1, max_length=20)
    building: str | None = Field(default=None, max_length=100)
    floor: int | None = None
    capacity: int | None = Field(default=None, ge=1)
    status: str = Field(default="ACTIVE", min_length=1, max_length=30)

    # Devices created together with the room (Plan v2 §8.1: the
    # registry records each room's fans and lights).
    fan_count: int = Field(default=0, ge=0, le=50)
    light_count: int = Field(default=0, ge=0, le=50)
    add_node_devices: bool = True


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
    # Only on create: devices added together with the room.
    devices_created: int | None = None

    model_config = ConfigDict(from_attributes=True)


class RoomCommand(BaseModel):
    """
    Circuit relay command for the room's demo panel (Plan v2 §11.3:
    relay switching is demonstration-panel only; classrooms are
    monitored, not switched).
    """

    target: Literal["LIGHTS", "FANS"]
    state: Literal["ON", "OFF"]


class CircuitLearn(BaseModel):
    """
    Units switched on right now; 0 records the standby current.
    """

    units_on: int = Field(..., ge=0, le=100)


class CircuitBaselineUpdate(BaseModel):
    unit_current_a: float = Field(..., gt=0, le=50)
    standby_current_a: float = Field(default=0, ge=0, le=50)


class StandardDevicesCreate(BaseModel):
    """
    Add fans "Fan 1..N", tube lights "Tube 1..N" and optionally the
    ESP32 node and camera to an existing room.
    """

    fan_count: int = Field(default=0, ge=0, le=50)
    light_count: int = Field(default=0, ge=0, le=50)
    add_node_devices: bool = True
