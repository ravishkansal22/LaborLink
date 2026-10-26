"""Worker profile schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import Availability, Trade

VerificationStatus = Literal["unverified"]


class WorkerLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    locality: str | None = Field(default=None, max_length=120,
                                 description="Optional area name shown to the worker only.")

    @field_validator("locality")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip() or None


def _clean_name(v: str) -> str:
    v = " ".join(v.split())
    if len(v) < 2:
        raise ValueError("display_name must contain at least 2 non-space characters")
    return v


def _unique_trades(v: list[Trade]) -> list[Trade]:
    if len(set(v)) != len(v):
        raise ValueError("trades must not contain duplicates")
    return v


class WorkerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=2, max_length=80)
    trades: list[Trade] = Field(min_length=1, max_length=4)
    years_experience: int | None = Field(default=None, ge=0, le=60)
    location: WorkerLocation
    service_radius_km: float = Field(default=10.0, gt=0, le=50)
    availability: Availability = Availability.available

    _name = field_validator("display_name")(_clean_name)
    _trades = field_validator("trades")(_unique_trades)


class WorkerUpdate(BaseModel):
    """Partial update. Only the fields sent are changed; `years_experience` may be null."""

    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=2, max_length=80)
    trades: list[Trade] | None = Field(default=None, min_length=1, max_length=4)
    years_experience: int | None = Field(default=None, ge=0, le=60)
    location: WorkerLocation | None = None
    service_radius_km: float | None = Field(default=None, gt=0, le=50)
    availability: Availability | None = None

    @field_validator("display_name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        return None if v is None else _clean_name(v)

    @field_validator("trades")
    @classmethod
    def _trades(cls, v: list[Trade] | None) -> list[Trade] | None:
        return None if v is None else _unique_trades(v)

    @model_validator(mode="after")
    def _non_empty(self) -> WorkerUpdate:
        if not self.model_fields_set:
            raise ValueError("provide at least one field to update")
        nullable = {"years_experience"}
        for name in self.model_fields_set - nullable:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class WorkerSummary(BaseModel):
    """Public subset of a profile shown to employers (no coordinates)."""

    id: str
    display_name: str
    trades: list[Trade]
    years_experience: int | None
    verification_status: VerificationStatus = "unverified"


class WorkerResponse(BaseModel):
    id: str
    display_name: str
    trades: list[Trade]
    years_experience: int | None
    location: WorkerLocation
    service_radius_km: float
    availability: Availability
    verification_status: VerificationStatus = Field(
        default="unverified",
        description="Profiles are self-declared; LaborLink performs no identity or skill checks.",
    )
    created_at: datetime
    updated_at: datetime

class NearbyWorkerItem(BaseModel):
    id: str
    display_name: str
    trades: list[Trade]
    years_experience: int | None
    distance_km: float
    locality: str | None = None
    availability: Availability


class NearbyWorkersResponse(BaseModel):
    items: list[NearbyWorkerItem]