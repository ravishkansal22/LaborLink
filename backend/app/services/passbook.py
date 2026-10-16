"""Kamai Passbook: a worker's work and earnings history, computed on every request from the
persisted bookings, completion reviews and settlements (no stored running totals, so repeated
calls can never double-count)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, CompletionReview, Job, Settlement
from app.schemas.common import JobStatus, ReviewDecision, SettlementStatus, Trade
from app.schemas.completion import AmountCount, PassbookEntry, PassbookResponse, PassbookSummary
from app.services.db_guard import db_guard
from app.services.workers import get_worker

ACTIVE = {JobStatus.booked, JobStatus.in_progress, JobStatus.awaiting_confirmation}


def _entry(booking: Booking, job: Job, review: CompletionReview | None,
           settlement: Settlement | None) -> PassbookEntry:
    status = JobStatus(job.status)
    total = booking.agreed_labour_amount + booking.travel_allowance
    confirmed = review is not None and review.decision == ReviewDecision.confirmed.value
    disputed = review is not None and review.decision == ReviewDecision.disputed.value

    if disputed:
        earning, settlement_status = "disputed", "withheld_disputed"
    elif confirmed and settlement is not None and \
            settlement.status == SettlementStatus.simulated_settled.value:
        earning, settlement_status = "settled", SettlementStatus.simulated_settled
    elif confirmed:
        earning = "confirmed_unsettled"
        settlement_status = SettlementStatus(settlement.status) if settlement else "none"
    else:
        earning, settlement_status = "in_progress", "none"

    summary = job.work_order.payload.get("problem_summary", "") if job.work_order else ""
    return PassbookEntry(
        job_id=job.id,
        booking_id=booking.id,
        trade=Trade(job.trade) if job.trade else None,
        problem_summary=summary,
        job_status=status,
        earning_status=earning,
        agreed_labour_amount=booking.agreed_labour_amount,
        travel_allowance=booking.travel_allowance,
        agreed_total_amount=total,
        currency=booking.currency,
        booked_at=booking.created_at,
        completed_at=review.reviewed_at if confirmed else None,
        disputed_at=review.reviewed_at if disputed else None,
        dispute_reason=review.dispute_reason if disputed else None,
        settlement_status=settlement_status,
        settled_at=settlement.settled_at if settlement else None,
    )


def build_passbook(session: Session, worker_id: str, *, default_currency: str,
                   limit: int = 50) -> PassbookResponse:
    worker = get_worker(session, worker_id)
    with db_guard(session):
        rows = session.execute(
            select(Booking, Job, CompletionReview, Settlement)
            .join(Job, Booking.job_id == Job.id)
            .outerjoin(CompletionReview, CompletionReview.job_id == Job.id)
            .outerjoin(Settlement, Settlement.job_id == Job.id)
            .where(Booking.worker_id == worker.id)
        ).all()
        entries = [_entry(*row) for row in rows]

    completed = [e for e in entries if e.earning_status in ("confirmed_unsettled", "settled")]
    settled = [e for e in entries if e.earning_status == "settled"]
    pending = [e for e in entries
               if e.settlement_status == SettlementStatus.simulated_pending]
    disputed = [e for e in entries if e.earning_status == "disputed"]
    summary = PassbookSummary(
        completed_jobs=len(completed),
        confirmed_earnings=sum(e.agreed_total_amount for e in completed),
        simulated_settled_earnings=sum(e.agreed_total_amount for e in settled),
        pending_settlements=AmountCount(count=len(pending),
                                        amount=sum(e.agreed_total_amount for e in pending)),
        disputed=AmountCount(count=len(disputed),
                             amount=sum(e.agreed_total_amount for e in disputed)),
        active_jobs=sum(1 for e in entries if e.job_status in ACTIVE),
    )
    entries.sort(
        key=lambda e: (e.completed_at or e.disputed_at or e.booked_at, e.job_id), reverse=True
    )
    currencies = {e.currency for e in entries}
    return PassbookResponse(
        worker_id=worker.id,
        worker_display_name=worker.display_name,
        currency=currencies.pop() if len(currencies) == 1 else default_currency,
        summary=summary,
        entries=entries[:limit],
        total_entries=len(entries),
        limit=limit,
    )
