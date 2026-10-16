"""Employer review of completed work and the simulated settlement ledger.

Guarantees:
- A settlement row is created only in the same transaction that records an employer
  *confirmation* (status `simulated_pending`). A dispute never creates one.
- Its amount is copied from the confirmed booking (labour + travel allowance); clients can
  never supply an amount.
- `settlements.booking_id` / `job_id` are UNIQUE, so a booking can never have two settlements.
- Moving `simulated_pending → simulated_settled` is a conditional UPDATE, so repeated or
  concurrent requests settle at most once.
No money is moved. There is no payment gateway, escrow or bank integration.
"""

from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db import utcnow
from app.errors import ConflictError, NotFoundError
from app.models import Booking, CompletionEvidence, CompletionReview, Job, Settlement, new_id
from app.schemas.common import JobStatus, ReviewDecision, SettlementStatus
from app.schemas.completion import (
    AgreedAmount,
    CompletionDecisionRequest,
    CompletionReviewResponse,
    SettlementRequest,
    SettlementResponse,
)
from app.services.actors import require_job_employer
from app.services.db_guard import db_guard
from app.services.execution import booking_for
from app.services.jobs import get_job
from app.services.lifecycle import apply_transition


class EvidenceMissingError(ConflictError):
    code = "completion_evidence_missing"


class AlreadyReviewedError(ConflictError):
    code = "completion_already_reviewed"


class CompletionNotConfirmedError(ConflictError):
    code = "completion_not_confirmed"


class JobDisputedError(ConflictError):
    code = "job_disputed"


class AlreadySettledError(ConflictError):
    code = "already_settled"


class SettlementInconsistentError(ConflictError):
    code = "settlement_inconsistent"


def _review_of(session: Session, job: Job) -> CompletionReview | None:
    return session.scalars(
        select(CompletionReview).where(CompletionReview.job_id == job.id)
    ).first()


def _settlement_of(session: Session, job: Job) -> Settlement | None:
    return session.scalars(select(Settlement).where(Settlement.job_id == job.id)).first()


# --- employer review ---------------------------------------------------------------------------

def review_completion(
    session: Session, job_id: str, payload: CompletionDecisionRequest
) -> tuple[CompletionReview, Settlement | None, Job]:
    job = get_job(session, job_id)
    booking = booking_for(session, job)
    require_job_employer(job, payload.employer_id)

    status = JobStatus(job.status)
    if status in (JobStatus.completed, JobStatus.disputed):
        with db_guard(session):
            existing = _review_of(session, job)
        raise AlreadyReviewedError(
            "This job's completion has already been reviewed; the decision is final.",
            details=[{"review_id": existing.id if existing else None, "job_status": status.value}],
        )
    if status is not JobStatus.awaiting_confirmation:
        raise EvidenceMissingError(
            "The worker has not submitted completion evidence yet.",
            details=[{"job_status": status.value}],
        )
    with db_guard(session):
        evidence = session.scalars(
            select(CompletionEvidence).where(CompletionEvidence.job_id == job.id)
        ).first()
    if evidence is None:
        raise EvidenceMissingError("The worker has not submitted completion evidence yet.")

    confirm = payload.decision == "confirm"
    review = CompletionReview(
        id=new_id(),
        job_id=job.id,
        booking_id=booking.id,
        evidence_id=evidence.id,
        employer_ref=payload.employer_id,
        decision=(ReviewDecision.confirmed if confirm else ReviewDecision.disputed).value,
        dispute_reason=None if confirm else payload.dispute_reason,
        agreed_labour_amount=booking.agreed_labour_amount,
        travel_allowance=booking.travel_allowance,
        currency=booking.currency,
    )
    settlement = None
    if confirm:
        settlement = Settlement(
            job_id=job.id,
            booking_id=booking.id,
            review_id=review.id,
            worker_id=booking.worker_id,
            employer_ref=payload.employer_id,
            labour_amount=booking.agreed_labour_amount,
            travel_allowance=booking.travel_allowance,
            amount=booking.agreed_labour_amount + booking.travel_allowance,
            currency=booking.currency,
            status=SettlementStatus.simulated_pending.value,
        )

    with db_guard(session, on_integrity_error=lambda: AlreadyReviewedError(
        "This job's completion has already been reviewed."
    )):
        apply_transition(session, job,
                         JobStatus.completed if confirm else JobStatus.disputed)
        session.add(review)
        if settlement is not None:
            session.add(settlement)
        session.commit()
    return review, settlement, job


def review_response(review: CompletionReview, settlement: Settlement | None,
                    job: Job) -> CompletionReviewResponse:
    confirmed = review.decision == ReviewDecision.confirmed.value
    return CompletionReviewResponse(
        id=review.id,
        job_id=review.job_id,
        booking_id=review.booking_id,
        evidence_id=review.evidence_id,
        employer_id=review.employer_ref,
        decision=ReviewDecision(review.decision),
        dispute_reason=review.dispute_reason,
        agreed_amount=AgreedAmount(
            labour_amount=review.agreed_labour_amount,
            travel_allowance=review.travel_allowance,
            total_amount=review.agreed_labour_amount + review.travel_allowance,
            currency=review.currency,
        ),
        reviewed_at=review.reviewed_at,
        job_status=JobStatus(job.status),
        settlement=settlement_response(settlement) if settlement else None,
        note=(
            "Completion confirmed. A simulated settlement for the agreed amount is pending; "
            "record it with POST /api/v1/jobs/{job_id}/settlement."
            if confirmed else
            "Completion disputed. The job will not be settled and the worker is not credited. "
            "Dispute resolution is not implemented in this prototype."
        ),
    )


# --- settlement --------------------------------------------------------------------------------

def settle(session: Session, job_id: str, payload: SettlementRequest) -> Settlement:
    job = get_job(session, job_id)
    booking: Booking = booking_for(session, job)
    require_job_employer(job, payload.employer_id)

    status = JobStatus(job.status)
    if status is JobStatus.disputed:
        raise JobDisputedError("Disputed jobs cannot be settled.")
    if status is not JobStatus.completed:
        raise CompletionNotConfirmedError(
            "The employer must confirm completion before settlement.",
            details=[{"job_status": status.value}],
        )
    with db_guard(session):
        settlement = _settlement_of(session, job)
    if settlement is None:
        raise SettlementInconsistentError(
            f"Job '{job.id}' is completed but has no settlement record."
        )
    if settlement.amount != booking.agreed_labour_amount + booking.travel_allowance:
        raise SettlementInconsistentError("Settlement amount does not match the booking.")
    if settlement.status == SettlementStatus.simulated_settled.value:
        raise AlreadySettledError(
            "This booking has already been settled (simulated).",
            details=[{"settlement_id": settlement.id,
                      "settled_at": settlement.settled_at.isoformat().replace("+00:00", "Z")}],
        )

    now = utcnow()
    with db_guard(session):
        changed = session.execute(
            update(Settlement)
            .where(Settlement.id == settlement.id,
                   Settlement.status == SettlementStatus.simulated_pending.value)
            .values(status=SettlementStatus.simulated_settled.value, settled_at=now)
            .execution_options(synchronize_session=False)
        ).rowcount
        if changed != 1:
            session.rollback()
            raise AlreadySettledError("This booking has already been settled (simulated).")
        session.commit()
    settlement.status = SettlementStatus.simulated_settled.value
    settlement.settled_at = now
    return settlement


def get_settlement(session: Session, job_id: str) -> Settlement:
    job = get_job(session, job_id)
    with db_guard(session):
        settlement = _settlement_of(session, job)
    if settlement is None:
        reason = (
            "it is disputed and will not be settled" if job.status == JobStatus.disputed.value
            else "completion has not been confirmed"
        )
        raise NotFoundError(f"Job '{job.id}' has no settlement: {reason}.")
    return settlement


def settlement_response(settlement: Settlement) -> SettlementResponse:
    return SettlementResponse(
        id=settlement.id,
        job_id=settlement.job_id,
        booking_id=settlement.booking_id,
        worker_id=settlement.worker_id,
        employer_id=settlement.employer_ref,
        amount=settlement.amount,
        labour_amount=settlement.labour_amount,
        travel_allowance=settlement.travel_allowance,
        currency=settlement.currency,
        status=SettlementStatus(settlement.status),
        created_at=settlement.created_at,
        settled_at=settlement.settled_at,
    )
