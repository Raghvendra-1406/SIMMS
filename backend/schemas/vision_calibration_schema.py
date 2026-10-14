from typing import Literal

from pydantic import BaseModel, Field


class FanCalibration(BaseModel):
    device_id: int
    x1: int = Field(..., ge=0)
    y1: int = Field(..., ge=0)
    x2: int = Field(..., ge=0)
    y2: int = Field(..., ge=0)


class LightCalibration(BaseModel):
    """
    Region around one tube light. threshold (0-1) overrides the
    default brightness threshold for this tube.
    """

    device_id: int
    x1: int = Field(..., ge=0)
    y1: int = Field(..., ge=0)
    x2: int = Field(..., ge=0)
    y2: int = Field(..., ge=0)
    threshold: float | None = Field(default=None, gt=0, lt=1)


class BoardCalibration(BaseModel):
    x1: int = Field(..., ge=0)
    y1: int = Field(..., ge=0)
    x2: int = Field(..., ge=0)
    y2: int = Field(..., ge=0)
    board_type: Literal["WHITEBOARD", "BLACKBOARD"] = "WHITEBOARD"


class SeatCalibration(BaseModel):
    seat_id: str = Field(..., min_length=1, max_length=20)
    x1: int = Field(..., ge=0)
    y1: int = Field(..., ge=0)
    x2: int = Field(..., ge=0)
    y2: int = Field(..., ge=0)


class VisionCalibrationData(BaseModel):
    fans: list[FanCalibration] = Field(default_factory=list)
    lights: list[LightCalibration] = Field(default_factory=list)
    board: BoardCalibration | None = None
    seats: list[SeatCalibration] = Field(default_factory=list)
