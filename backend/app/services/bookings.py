"""Booking confirmation: one transaction, guarded against double booking.

Double-booking protection (two layers):
  1. `UPDATE jobs SET status='booked' WHERE id=:id AND status='estimated'` — only the first of
     two concurrent requests changes a row; the other sees rowcount 0 and is rejected.
  2. `bookings.job_id` is UNIQUE — a second booking row for a job can never be committed.
"""

from __future__ import annotations

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.db import utcnow
from app.errors import AppError, ConflictError, InvalidReferenceError, NotFoundError
from app.models import Booking, Job, Offer
from app.schemas.common import BookingStatus, JobStatus, OfferStatus
from app.schemas.marketplace import BookingCreate, BookingResponse
from app.schemas.pricing import RateCard
from app.services.db_guard import db_guard
from app.services.jobs import get_job
from app.services.lifecycle import ensure_transition, require_open
from app.services.matching import assess
from app.services.offers import check_amount, current_terms, ineligible_error
from app.services.workers import to_summary

CLOSED_BY_BOOKING = "another_offer_booked"


class JobAlreadyBookedError(ConflictError):
    code = "job_already_booked"


class OfferNotPendingError(ConflictError):
    code = "offer_not_pending"


class OfferJobMismatchError(AppError):
    status_code = 422
    code = "offer_job_mismatch"


def _already_booked(job_id: str) -> JobAlreadyBookedError:
    return JobAlreadyBookedError(f"Job '{job_id}' already has a confirmed booking.")


def confirm_booking(
    session: Session, job_id: str, payload: BookingCreate, *, card: RateCard
) -> Booking:
    job = get_job(session, job_id)  # 1. job exists
    with db_guard(session):
        offer = session.get(Offer, payload.offer_id)
        if offer is not None:
            _ = offer.worker
    if offer is None:
        raise InvalidReferenceError(f"offer_id '{payload.offer_id}' does not exist.")
    if offer.job_id != job.id:  # 2. offer belongs to this job
        raise OfferJobMismatchError(
            f"Offer '{offer.id}' belongs to a different job, not '{job.id}'."
        )
    if job.status == JobStatus.booked.value:  # 4. job still open
        raise _already_booked(job.id)
    require_open(job)
    ensure_transition(job, JobStatus.booked)
    if offer.closed_reason == CLOSED_BY_BOOKING:
        raise _already_booked(job.id)  # job read before a concurrent booking committed
    if offer.status != OfferStatus.pending.value:  # 5. offer still valid
        raise OfferNotPendingError(f"Offer '{offer.id}' is '{offer.status}', not pending.")
    assessment = assess(offer.worker, job)  # 3. worker still eligible
    if not assessment.eligible:
        raise ineligible_error(assessment.issues)
    check_amount(current_terms(job, card), offer.labour_amount)  # 6. amount still permitted

    now = utcnow()
    with db_guard(session, on_integrity_error=lambda: _already_booked(job.id)):
        claimed = session.execute(  # 8. job state -> booked (only if still open)
            update(Job)
            .where(Job.id == job.id, Job.status == JobStatus.estimated.value)
            .values(status=JobStatus.booked.value, updated_at=now)
            .execution_options(synchronize_session=False)
        ).rowcount
        if claimed != 1:  # someone else booked the job after we read it
            session.rollback()
            raise _already_booked(job.id)
        booking = Booking(  # 7. persistent booking
            job_id=job.id,
            offer_id=offer.id,
            worker_id=offer.worker_id,
            agreed_labour_amount=offer.labour_amount,
            travel_allowance=offer.travel_allowance,
            currency=offer.currency,
            status=BookingStatus.confirmed.value,
        )
        session.add(booking)
        offer.status = OfferStatus.accepted.value  # 9. selected offer accepted
        offer.updated_at = now
        session.execute(  # 10. competing offers closed
            update(Offer)
            .where(Offer.job_id == job.id, Offer.id != offer.id,
                   Offer.status == OfferStatus.pending.value)
            .values(status=OfferStatus.rejected.value, closed_reason=CLOSED_BY_BOOKING,
                    updated_at=now)
            .execution_options(synchronize_session=False)
        )
        session.commit()
    job.status = JobStatus.booked.value  # keep the in-memory object in step with the row
    return booking


def get_booking(session: Session, job_id: str) -> Booking:
    job = get_job(session, job_id)
    with db_guard(session):
        booking = session.query(Booking).filter(Booking.job_id == job.id).one_or_none()
        if booking is not None:
            _ = booking.worker, booking.offer
    if booking is None:
        raise NotFoundError(f"Job '{job.id}' has no booking.")
    return booking


def to_response(booking: Booking) -> BookingResponse:
    return BookingResponse(
        id=booking.id,
        job_id=booking.job_id,
        offer_id=booking.offer_id,
        status=BookingStatus(booking.status),
        worker=to_summary(booking.worker),
        agreed_labour_amount=booking.agreed_labour_amount,
        travel_allowance=booking.travel_allowance,
        agreed_total_amount=booking.agreed_labour_amount + booking.travel_allowance,
        currency=booking.currency,
        price_estimate_id=booking.offer.price_estimate_id,
        created_at=booking.created_at,
    )
