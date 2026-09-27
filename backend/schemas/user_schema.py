from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: str = Field(..., min_length=1, max_length=30)
    is_active: bool = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    role: str = Field(..., min_length=1, max_length=30)
    is_active: bool = True


class PasswordUpdate(BaseModel):
    password: str = Field(..., min_length=8)


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserResponse(BaseModel):
    user_id: int
    name: str
    email: EmailStr
    role: str
    created_at: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class UserLoginResponse(BaseModel):
    access_token: str
    token_type: str

    user_id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)