"""Schemas for live worker location sharing."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import JobStatus


class LocationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worker_id: str = Field(min_length=1, max_length=36)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=100_000)


class SharedLocation(BaseModel):
    latitude: float
    longitude: float
    accuracy_m: float | None
    recorded_at: datetime
    age_seconds: int
    stale: bool


class Destination(BaseModel):
    latitude: float
    longitude: float
    address: str | None


class TrackingView(BaseModel):
    job_id: str
    job_status: JobStatus
    worker_id: str
    worker_name: str
    worker_location: SharedLocation | None
    destination: Destination | None
    distance_km: float | None
    eta_minutes: int | None
    arrived: bool
    eta_basis: str
