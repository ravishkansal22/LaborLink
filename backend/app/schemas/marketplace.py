"""Schemas for matching, job discovery, offers and bookings (Phase 2)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import (
    Availability,
    BookingStatus,
    Complexity,
    JobStatus,
    OfferKind,
    OfferStatus,
    Trade,
    Urgency,
)
from app.schemas.pricing import OfferTerms
from app.schemas.work_order import DurationRange
from app.schemas.workers import WorkerSummary

# --- matching ----------------------------------------------------------------------------------


class MatchCandidate(BaseModel):
    worker: WorkerSummary
    availability: Availability
    distance_km: float | None
    service_radius_km: float
    within_service_radius: bool | None
    score: float
    score_breakdown: dict[str, float]
    reasons: list[str]
    limitations: list[str]


class MatchResponse(BaseModel):
    job_id: str
    trade: Trade
    distance_matching: Literal["complete", "unavailable"]
    limitations: list[str]
    scoring: str
    candidates: list[MatchCandidate]
    excluded: dict[str, int]


# --- worker job discovery ----------------------------------------------------------------------


class JobOpportunity(BaseModel):
    """An open job as shown to a worker. The employer's address is not included."""

    job_id: str
    trade: Trade
    problem_category: str
    problem_summary: str
    description: str  # the employer's own words
    image_id: str | None  # the employer's photo of the problem, if any (GET /images/{id})
    complexity: Complexity
    urgency: Urgency
    estimated_duration: DurationRange
    distance_km: float | None
    limitations: list[str]
    offer_terms: OfferTerms
    has_active_offer: bool
    created_at: datetime


class OpportunitiesResponse(BaseModel):
    worker_id: str
    worker_availability: Availability
    limitations: list[str]
    items: list[JobOpportunity]


# --- offers ------------------------------------------------------------------------------------


class OfferCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worker_id: str = Field(min_length=1, max_length=36)
    kind: OfferKind
    labour_amount: int | None = Field(
        default=None, gt=0, le=10_000_000,
        description="Required for `counter`; must be omitted for `accept_suggested`.",
    )
    message: str | None = Field(default=None, max_length=280)

    @model_validator(mode="after")
    def _amount_matches_kind(self) -> OfferCreate:
        if self.kind is OfferKind.counter and self.labour_amount is None:
            raise ValueError("labour_amount is required for a counter offer")
        if self.kind is OfferKind.accept_suggested and self.labour_amount is not None:
            raise ValueError(
                "labour_amount must be omitted when accepting the suggested amount"
            )
        if self.message is not None:
            self.message = self.message.strip() or None
        return self


class OfferResponse(BaseModel):
    id: str
    job_id: str
    worker: WorkerSummary
    kind: OfferKind
    labour_amount: int
    travel_allowance: int
    total_amount: int
    currency: str
    price_estimate_id: str
    message: str | None
    status: OfferStatus
    closed_reason: str | None
    created_at: datetime
    updated_at: datetime


class OfferComparison(OfferResponse):
    """Offer plus the context an employer needs to compare candidates (not just price)."""

    distance_km: float | None
    match_score: float | None
    difference_from_suggested: int | None
    currently_eligible: bool
    eligibility_issues: list[str]


class JobOffersResponse(BaseModel):
    job_id: str
    job_status: JobStatus
    offer_terms: OfferTerms | None
    ordering: str
    offers: list[OfferComparison]


class WorkerOfferItem(OfferResponse):
    job_status: JobStatus
    job_trade: Trade | None
    problem_summary: str


class WorkerOffersResponse(BaseModel):
    worker_id: str
    offers: list[WorkerOfferItem]


# --- bookings ----------------------------------------------------------------------------------


class BookingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    offer_id: str = Field(min_length=1, max_length=36)
    employer_id: str | None = Field(
        default=None,
        pattern=r"^[A-Za-z0-9_.:@-]{1,64}$",
        description="Optional. Records the employer on jobs created without one; must match "
        "the job's employer_id if it already has one (prototype check, not authentication).",
    )


class BookingResponse(BaseModel):
    id: str
    job_id: str
    offer_id: str
    status: BookingStatus
    worker: WorkerSummary
    agreed_labour_amount: int
    travel_allowance: int
    agreed_total_amount: int
    currency: str
    price_estimate_id: str
    payment: Literal["not_handled"] = Field(
        default="not_handled",
        description="LaborLink does not process payments in Phase 2.",
    )
    created_at: datetime
