"""Job intake request and job response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import JobStatus, Trade, Urgency
from app.schemas.pricing import PriceEstimate
from app.schemas.work_order import WorkOrderV1


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")

    address: str | None = Field(default=None, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("address")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @model_validator(mode="after")
    def _has_something(self) -> Location:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        if self.address is None and self.latitude is None:
            raise ValueError("provide an address, coordinates, or both")
        return self

    @property
    def has_coordinates(self) -> bool:
        return self.latitude is not None


class JobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str = Field(
        min_length=3,
        max_length=2000,
        description="Employer's written description or the transcript of their voice note.",
    )
    description_source: Literal["text", "voice_transcript"] = "text"
    language: str | None = Field(
        default=None, max_length=16, description="Optional BCP-47 tag, e.g. 'en', 'hi'."
    )
    trade: Trade | None = Field(
        default=None, description="Trade chosen by the employer; inferred when omitted."
    )
    urgency: Urgency = Urgency.normal
    location: Location
    image_id: str | None = Field(
        default=None,
        max_length=36,
        description="id returned by POST /api/v1/images (optional).",
    )
    employer_id: str | None = Field(
        default=None,
        pattern=r"^[A-Za-z0-9_.:@-]{1,64}$",
        description="Optional self-asserted employer label (not authentication). Required later "
        "to confirm completion and settle; can also be set when confirming the booking.",
    )

    @field_validator("description")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("description must contain at least 3 non-space characters")
        return v


class JobRequestDetails(BaseModel):
    description: str
    description_source: str
    language: str | None
    requested_trade: Trade | None
    urgency: Urgency
    location: Location
    image_id: str | None


class JobResponse(BaseModel):
    id: str
    status: JobStatus
    trade: Trade | None
    employer_id: str | None = None
    request: JobRequestDetails
    work_order: WorkOrderV1
    price_estimate: PriceEstimate | None
    created_at: datetime
    updated_at: datetime


class ImageUploadResponse(BaseModel):
    id: str
    content_type: str
    size_bytes: int
    sha256: str
    created_at: datetime
