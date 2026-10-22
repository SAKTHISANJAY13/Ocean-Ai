from __future__ import annotations
import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from ..security import validate_password_strength, normalize_email


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name of investigator")
    email: EmailStr = Field(..., description="Corporate or institutional email address")
    password: str = Field(..., min_length=8, max_length=128, description="Secure user password")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("Name must be at least 2 characters long")
        return clean

    @field_validator("email")
    @classmethod
    def normalize_user_email(cls, v: str) -> str:
        return normalize_email(str(v))

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        valid, msg = validate_password_strength(v)
        if not valid:
            raise ValueError(msg)
        return v


class LoginRequest(BaseModel):
    email: str = Field(..., description="Account email address")
    password: str = Field(..., description="Account password")

    @field_validator("email")
    @classmethod
    def normalize_login_email(cls, v: str) -> str:
        return normalize_email(v)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    csrf_token: Optional[str] = None


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None


class CSRFResponse(BaseModel):
    csrf_token: str
