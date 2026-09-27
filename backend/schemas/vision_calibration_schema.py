from pydantic import BaseModel, Field


class FanCalibration(BaseModel):
    device_id: int
    x1: int = Field(..., ge=0)
    y1: int = Field(..., ge=0)
    x2: int = Field(..., ge=0)
    y2: int = Field(..., ge=0)


class VisionCalibrationData(BaseModel):
    fans: list[FanCalibration]