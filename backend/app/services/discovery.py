"""Job discovery for workers: open jobs that match a worker's trades and service area."""

from __future__ import annotations

import math

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Job, Offer
from app.schemas.common import Availability, Complexity, JobStatus, OfferStatus, Trade, Urgency
from app.schemas.marketplace import JobOpportunity, OpportunitiesResponse
from app.schemas.pricing import RateCard
from app.schemas.work_order import WorkOrderV1
from app.services.db_guard import db_guard
from app.services.matching import NO_EXPERIENCE, assess
from app.services.offers import EstimateUnavailableError, current_terms
from app.services.workers import get_worker


def discover_jobs(
    session: Session, worker_id: str, *, card: RateCard, limit: int = 20
) -> OpportunitiesResponse:
    worker = get_worker(session, worker_id)
    if worker.availability != Availability.available.value:
        return OpportunitiesResponse(
            worker_id=worker.id,
            worker_availability=Availability(worker.availability),
            limitations=["You are marked as unavailable; set availability to 'available' "
                         "to see open jobs."],
            items=[],
        )

    with db_guard(session):
        jobs = list(session.scalars(
            select(Job).where(Job.status == JobStatus.estimated.value,
                              Job.trade.in_(worker.trades))
        ))
        active_jobs = set(session.scalars(
            select(Offer.job_id).where(Offer.worker_id == worker.id,
                                       Offer.status == OfferStatus.pending.value)
        ))
        for job in jobs:
            _ = job.work_order, job.price_estimates

    items: list[JobOpportunity] = []
    for job in jobs:
        a = assess(worker, job)
        if not a.eligible or job.work_order is None:
            continue
        try:
            terms = current_terms(job, card)
        except EstimateUnavailableError:
            continue  # cannot be offered on safely; skip rather than show an arbitrary price
        wo = WorkOrderV1.model_validate(job.work_order.payload)
        items.append(JobOpportunity(
            job_id=job.id,
            trade=Trade(job.trade),
            problem_category=wo.problem_category,
            problem_summary=wo.problem_summary,
            complexity=Complexity(wo.complexity),
            urgency=Urgency(job.urgency),
            estimated_duration=wo.estimated_duration,
            distance_km=a.distance_km,
            limitations=[lim for lim in a.limitations if lim != NO_EXPERIENCE],
            offer_terms=terms,
            has_active_offer=job.id in active_jobs,
            created_at=job.created_at,
        ))
    items.sort(key=lambda i: (i.distance_km if i.distance_km is not None else math.inf,
                              i.created_at, i.job_id))
    return OpportunitiesResponse(
        worker_id=worker.id,
        worker_availability=Availability.available,
        limitations=[],
        items=items[:limit],
    )
