"""Schemas for job execution, completion evidence, employer review, simulated settlement and
the Kamai Passbook (Phase 3)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import JobStatus, ReviewDecision, SettlementStatus, Trade

ACTOR_PATTERN = r"^[A-Za-z0-9_.:@-]{1,64}$"

EVIDENCE_DISCLAIMER = (
    "Photos and notes support the employer's review. They do not prove the quality or "
    "correctness of the work."
)
SETTLEMENT_DISCLAIMER = (
    "Simulated demo settlement. No money has been moved: LaborLink does not process payments, "
    "hold funds in escrow or connect to banks."
)
PASSBOOK_DISCLAIMER = (
    "Kamai Passbook: a work and earnings history computed from this prototype's records. "
    "Settlements are simulated. It is not a bank statement, a credit score or proof of loan "
    "eligibility."
)


# --- start -------------------------------------------------------------------------------------


class JobStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worker_id: str = Field(min_length=1, max_length=36,
                           description="Must be the worker assigned to the booking.")


class JobExecutionResponse(BaseModel):
    job_id: str
    job_status: JobStatus
    booking_id: str
    worker_id: str
    started_at: datetime


# --- evidence ----------------------------------------------------------------------------------


class EvidenceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worker_id: str = Field(min_length=1, max_length=36)
    before_image_ids: list[str] = Field(default_factory=list, max_length=5)
    after_image_ids: list[str] = Field(min_length=1, max_length=5)
    note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _distinct_images(self) -> EvidenceCreate:
        ids = [*self.before_image_ids, *self.after_image_ids]
        if any(not i or len(i) > 36 for i in ids):
            raise ValueError("image ids must be 1-36 characters")
        if len(set(ids)) != len(ids):
            raise ValueError("each image may appear only once across before/after photos")
        if self.note is not None:
            self.note = self.note.strip() or None
        return self


class EvidenceImage(BaseModel):
    image_id: str
    content_type: str
    size_bytes: int
    sha256: str


class EvidenceResponse(BaseModel):
    id: str
    job_id: str
    booking_id: str
    worker_id: str
    before_images: list[EvidenceImage]
    after_images: list[EvidenceImage]
    note: str | None
    submitted_at: datetime
    job_status: JobStatus
    disclaimer: str = EVIDENCE_DISCLAIMER


# --- employer review ---------------------------------------------------------------------------


class CompletionDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    employer_id: str = Field(pattern=ACTOR_PATTERN)
    decision: Literal["confirm", "dispute"]
    dispute_reason: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _reason_matches_decision(self) -> CompletionDecisionRequest:
        reason = (self.dispute_reason or "").strip()
        if self.decision == "dispute":
            if len(reason) < 5:
                raise ValueError("dispute_reason (at least 5 characters) is required to dispute")
            self.dispute_reason = reason
        elif self.dispute_reason is not None:
            raise ValueError("dispute_reason must be omitted when confirming")
        return self


class AgreedAmount(BaseModel):
    labour_amount: int
    travel_allowance: int
    total_amount: int
    currency: str


class SettlementResponse(BaseModel):
    id: str
    job_id: str
    booking_id: str
    worker_id: str
    employer_id: str
    amount: int = Field(description="Agreed booking total (labour + travel allowance).")
    labour_amount: int
    travel_allowance: int
    currency: str
    status: SettlementStatus
    mode: Literal["simulated"] = "simulated"
    created_at: datetime
    settled_at: datetime | None
    disclaimer: str = SETTLEMENT_DISCLAIMER


class CompletionReviewResponse(BaseModel):
    id: str
    job_id: str
    booking_id: str
    evidence_id: str
    employer_id: str
    decision: ReviewDecision
    dispute_reason: str | None
    agreed_amount: AgreedAmount
    reviewed_at: datetime
    job_status: JobStatus
    settlement: SettlementResponse | None
    note: str


# --- settlement --------------------------------------------------------------------------------


class SettlementRequest(BaseModel):
    """Only the employer label is accepted; the amount always comes from the booking."""

    model_config = ConfigDict(extra="forbid")

    employer_id: str = Field(pattern=ACTOR_PATTERN)


# --- passbook ----------------------------------------------------------------------------------

EarningStatus = Literal["in_progress", "confirmed_unsettled", "settled", "disputed"]


class PassbookEntry(BaseModel):
    job_id: str
    booking_id: str
    trade: Trade | None
    problem_summary: str
    job_status: JobStatus
    earning_status: EarningStatus
    agreed_labour_amount: int
    travel_allowance: int
    agreed_total_amount: int
    currency: str
    booked_at: datetime
    completed_at: datetime | None
    disputed_at: datetime | None
    dispute_reason: str | None
    settlement_status: SettlementStatus | Literal["none", "withheld_disputed"]
    settled_at: datetime | None


class AmountCount(BaseModel):
    count: int
    amount: int


class PassbookSummary(BaseModel):
    completed_jobs: int
    confirmed_earnings: int = Field(
        description="Agreed totals of employer-confirmed jobs (settled or pending)."
    )
    simulated_settled_earnings: int
    pending_settlements: AmountCount
    disputed: AmountCount = Field(description="Disputed jobs; never counted as earnings.")
    active_jobs: int = Field(description="Booked, in progress or awaiting confirmation.")


class PassbookResponse(BaseModel):
    worker_id: str
    worker_display_name: str
    currency: str
    summary: PassbookSummary
    entries: list[PassbookEntry]
    total_entries: int
    limit: int
    disclaimer: str = PASSBOOK_DISCLAIMER
