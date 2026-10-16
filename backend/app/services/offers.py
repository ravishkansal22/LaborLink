"""Worker offers (accept the suggested amount, or counter within the permitted range)."""

from __future__ import annotations

import logging

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ConflictError, InvalidReferenceError
from app.models import Job, Offer, Worker
from app.schemas.common import JobStatus, OfferKind, OfferStatus, Trade
from app.schemas.marketplace import (
    JobOffersResponse,
    OfferComparison,
    OfferCreate,
    OfferResponse,
    WorkerOfferItem,
    WorkerOffersResponse,
)
from app.schemas.pricing import OfferTerms, RateCard
from app.services.db_guard import db_guard
from app.services.jobs import estimate_from_record, get_job
from app.services.lifecycle import require_open
from app.services.matching import assess
from app.services.pricing import offer_terms
from app.services.workers import get_worker, to_summary

logger = logging.getLogger("laborlink.offers")


class EstimateUnavailableError(ConflictError):
    code = "estimate_unavailable"


class WorkerNotEligibleError(ConflictError):
    code = "worker_not_eligible"


class DuplicateOfferError(ConflictError):
    code = "duplicate_offer"


class OfferOutOfRangeError(AppError):
    status_code = 422
    code = "offer_out_of_range"


ISSUE_MESSAGES = {
    "trade_mismatch": "The worker does not offer this job's trade.",
    "unavailable": "The worker is marked as unavailable.",
    "outside_service_radius": "The job is outside the worker's service radius.",
}


def current_terms(job: Job, card: RateCard) -> OfferTerms:
    """Offer terms from the job's current FairRate estimate; error if there is none/invalid."""
    record = job.current_estimate
    if record is None:
        raise EstimateUnavailableError(
            f"Job '{job.id}' has no price estimate, so offers cannot be validated."
        )
    try:
        return offer_terms(card, estimate_from_record(record))
    except (ValidationError, ValueError) as exc:
        logger.error("Stored estimate %s is invalid: %s", record.id, type(exc).__name__)
        raise EstimateUnavailableError(
            f"The price estimate for job '{job.id}' is invalid; recalculate it first."
        ) from exc


def check_amount(terms: OfferTerms, amount: int) -> None:
    if not terms.permitted_min <= amount <= terms.permitted_max:
        raise OfferOutOfRangeError(
            f"labour_amount must be between {terms.permitted_min} and {terms.permitted_max} "
            f"{terms.currency}.",
            details=[{
                "permitted_min": terms.permitted_min,
                "permitted_max": terms.permitted_max,
                "currency": terms.currency,
                "basis": terms.basis,
            }],
        )


def ineligible_error(issues: list[str]) -> WorkerNotEligibleError:
    return WorkerNotEligibleError(
        "The worker is not eligible for this job.",
        details=[{"issue": i, "message": ISSUE_MESSAGES.get(i, i)} for i in issues],
    )


def _active_offer(session: Session, job_id: str, worker_id: str) -> Offer | None:
    return session.scalars(
        select(Offer).where(
            Offer.job_id == job_id,
            Offer.worker_id == worker_id,
            Offer.status == OfferStatus.pending.value,
        )
    ).first()


def create_offer(session: Session, job_id: str, payload: OfferCreate, *, card: RateCard) -> Offer:
    job = get_job(session, job_id)
    require_open(job)
    with db_guard(session):
        worker = session.get(Worker, payload.worker_id)
    if worker is None:
        raise InvalidReferenceError(f"worker_id '{payload.worker_id}' does not exist.")

    terms = current_terms(job, card)
    assessment = assess(worker, job)
    if not assessment.eligible:
        raise ineligible_error(assessment.issues)

    with db_guard(session):
        existing = _active_offer(session, job.id, worker.id)
    if existing is not None:
        raise DuplicateOfferError(
            "This worker already has a pending offer for this job.",
            details=[{"offer_id": existing.id}],
        )

    if payload.kind is OfferKind.accept_suggested:
        amount = terms.suggested_labour_amount
    else:
        amount = payload.labour_amount
        check_amount(terms, amount)

    offer = Offer(
        job_id=job.id,
        worker_id=worker.id,
        price_estimate_id=terms.price_estimate_id,
        kind=payload.kind.value,
        labour_amount=amount,
        travel_allowance=terms.travel_allowance,
        currency=terms.currency,
        message=payload.message,
        status=OfferStatus.pending.value,
    )
    # The partial unique index catches a concurrent duplicate that slipped past the check above.
    with db_guard(session, on_integrity_error=lambda: DuplicateOfferError(
        "This worker already has a pending offer for this job."
    )):
        session.add(offer)
        session.commit()
    return offer


def to_response(offer: Offer) -> OfferResponse:
    return OfferResponse(**_base_fields(offer))


def _base_fields(offer: Offer) -> dict:
    return dict(
        id=offer.id,
        job_id=offer.job_id,
        worker=to_summary(offer.worker),
        kind=OfferKind(offer.kind),
        labour_amount=offer.labour_amount,
        travel_allowance=offer.travel_allowance,
        total_amount=offer.labour_amount + offer.travel_allowance,
        currency=offer.currency,
        price_estimate_id=offer.price_estimate_id,
        message=offer.message,
        status=OfferStatus(offer.status),
        closed_reason=offer.closed_reason,
        created_at=offer.created_at,
        updated_at=offer.updated_at,
    )


def list_job_offers(session: Session, job_id: str, *, card: RateCard) -> JobOffersResponse:
    job = get_job(session, job_id)
    with db_guard(session):
        offers = list(session.scalars(
            select(Offer).where(Offer.job_id == job.id).order_by(Offer.created_at, Offer.id)
        ))
        for o in offers:
            _ = o.worker
    terms: OfferTerms | None = None
    if job.current_estimate is not None:
        try:
            terms = current_terms(job, card)
        except EstimateUnavailableError:
            terms = None

    items = []
    for o in offers:
        a = assess(o.worker, job)
        items.append(OfferComparison(
            **_base_fields(o),
            distance_km=a.distance_km,
            match_score=a.score if a.eligible else None,
            difference_from_suggested=(
                o.labour_amount - terms.suggested_labour_amount if terms else None
            ),
            currently_eligible=a.eligible,
            eligibility_issues=[ISSUE_MESSAGES.get(i, i) for i in a.issues],
        ))
    return JobOffersResponse(
        job_id=job.id,
        job_status=JobStatus(job.status),
        offer_terms=terms,
        ordering="Oldest first. Offers are not ranked by price; compare amount, distance, "
                 "experience and match_score.",
        offers=items,
    )


def list_worker_offers(session: Session, worker_id: str) -> WorkerOffersResponse:
    worker = get_worker(session, worker_id)
    with db_guard(session):
        rows = list(session.execute(
            select(Offer, Job).join(Job, Offer.job_id == Job.id)
            .where(Offer.worker_id == worker.id)
            .order_by(Offer.created_at.desc(), Offer.id)
        ))
        items = []
        for offer, job in rows:
            summary = job.work_order.payload.get("problem_summary", "") if job.work_order else ""
            items.append(WorkerOfferItem(
                **_base_fields(offer),
                job_status=JobStatus(job.status),
                job_trade=Trade(job.trade) if job.trade else None,
                problem_summary=summary,
            ))
    return WorkerOffersResponse(worker_id=worker.id, offers=items)
