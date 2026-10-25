from __future__ import annotations

import re
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class AuthLoginRequest(BaseModel):
    phone: str | None = Field(
        default=None,
        description="10-digit mobile number or E.164 format (e.g. +919876543210)"
    )
    email: str | None = Field(
        default=None,
        description="User email address"
    )
    name: str | None = Field(
        default=None,
        description="Optional display name"
    )
    role: str = Field(
        default="worker",
        description="Role preference: 'worker', 'employer', or 'both'"
    )
    mode: Literal["auto", "login", "register"] = Field(
        default="auto",
        description="'login' (fails if user not found), 'register' (fails if user exists), or 'auto' (creates or links)"
    )

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if not v:
            return None
        cleaned = re.sub(r"[\s\-\(\)]", "", v.strip())
        # Accepts standard 10-digit numbers or international E.164 (+91 followed by 10 digits)
        if not re.match(r"^(\+?[1-9]\d{1,14}|[6-9]\d{9})$", cleaned):
            raise ValueError("Enter a valid phone number (e.g., 10 digits or +91 format).")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if not v:
            return None
        cleaned = v.strip().lower()
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", cleaned):
            raise ValueError("Enter a valid email address.")
        return cleaned


class UserProfileResponse(BaseModel):
    user_id: str
    phone: str | None = None
    email: str | None = None
    name: str | None = None
    role: str
    created_at: datetime
    is_new: bool = False