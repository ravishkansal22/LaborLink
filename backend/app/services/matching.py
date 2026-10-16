"""Worker ↔ job matching: eligibility, distance and a transparent, deterministic score.

Eligibility (all must hold):
  1. the worker lists the job's trade;
  2. the worker is `available`;
  3. if the job has coordinates: haversine distance <= the worker's service radius.
     If the job has no coordinates, distance is reported as unknown (never invented) and the
     radius rule cannot be applied — this is returned as an explicit limitation.

Score (0-100, higher is better; price is never part of it):
  distance   up to 60 points: 60 x (1 - distance / service_radius); 0 when distance is unknown
  experience up to 40 points: 40 x min(years, 10) / 10; 0 when not provided
Ties are broken by distance (unknown last), then worker id, so results are deterministic.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Job, Worker
from app.schemas.common import Availability, Trade
from app.schemas.marketplace import MatchCandidate, MatchResponse
from app.services.db_guard import db_guard
from app.services.lifecycle import require_open
from app.services.workers import to_summary

EARTH_RADIUS_KM = 6371.0088
DISTANCE_POINTS = 60.0
EXPERIENCE_POINTS = 40.0
EXPERIENCE_CAP_YEARS = 10

SCORING_DESCRIPTION = (
    "score = distance points (up to 60, closer within the worker's service radius is better) "
    "+ experience points (up to 40, capped at 10 years). Price is not used for ranking. "
    "Ties: nearer first, then worker id."
)

NO_JOB_COORDINATES = (
    "The job has no map coordinates, so distances and service radii could not be checked. "
    "Add coordinates to the job for distance-based matching."
)

NO_EXPERIENCE = "Experience not provided."


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(min(1.0, a)))


@dataclass(frozen=True)
class Assessment:
    eligible: bool
    issues: list[str] = field(default_factory=list)  # codes: trade_mismatch, unavailable, ...
    reasons: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    distance_km: float | None = None
    within_radius: bool | None = None
    score: float = 0.0
    breakdown: dict[str, float] = field(default_factory=dict)


def assess(worker: Worker, job: Job) -> Assessment:
    """Evaluate one worker for one job. Pure function of the two records."""
    issues: list[str] = []
    reasons: list[str] = []
    limitations: list[str] = []

    trade = Trade(job.trade) if job.trade else None
    if trade is None or trade.value not in worker.trades:
        issues.append("trade_mismatch")
    else:
        reasons.append(f"Offers {trade.value} work")

    if worker.availability != Availability.available.value:
        issues.append("unavailable")
    else:
        reasons.append("Marked as available")

    distance: float | None = None
    within: bool | None = None
    if job.latitude is not None and job.longitude is not None:
        distance = round(haversine_km(worker.latitude, worker.longitude,
                                      job.latitude, job.longitude), 2)
        within = distance <= worker.service_radius_km
        if within:
            reasons.append(
                f"{distance:g} km away, within a {worker.service_radius_km:g} km service radius"
            )
        else:
            issues.append("outside_service_radius")
    else:
        limitations.append(NO_JOB_COORDINATES)

    distance_pts = (
        DISTANCE_POINTS * (1 - distance / worker.service_radius_km) if within else 0.0
    )
    years = worker.years_experience
    if years is None:
        experience_pts = 0.0
        limitations.append(NO_EXPERIENCE)
    else:
        experience_pts = EXPERIENCE_POINTS * min(years, EXPERIENCE_CAP_YEARS) / EXPERIENCE_CAP_YEARS
        reasons.append(f"{years} year{'s' if years != 1 else ''} of self-reported experience")

    breakdown = {"distance": round(distance_pts, 2), "experience": round(experience_pts, 2)}
    return Assessment(
        eligible=not issues,
        issues=issues,
        reasons=reasons,
        limitations=limitations,
        distance_km=distance,
        within_radius=within,
        score=round(distance_pts + experience_pts, 2),
        breakdown=breakdown,
    )


def rank_key(worker: Worker, a: Assessment) -> tuple:
    return (-a.score, a.distance_km if a.distance_km is not None else math.inf, worker.id)


def match_workers(session: Session, job: Job, *, limit: int = 20) -> MatchResponse:
    require_open(job)
    # Demo scale: scan all workers and filter in Python (no geospatial index needed).
    with db_guard(session):
        workers = list(session.scalars(select(Worker)))

    excluded = {"trade_mismatch": 0, "unavailable": 0, "outside_service_radius": 0}
    scored: list[tuple[Worker, Assessment]] = []
    for worker in workers:
        a = assess(worker, job)
        if a.eligible:
            scored.append((worker, a))
        else:
            # Count each excluded worker once, under its first failing rule.
            excluded[a.issues[0]] += 1
    scored.sort(key=lambda pair: rank_key(*pair))

    has_coords = job.latitude is not None and job.longitude is not None
    candidates = [
        MatchCandidate(
            worker=to_summary(w),
            availability=Availability(w.availability),
            distance_km=a.distance_km,
            service_radius_km=w.service_radius_km,
            within_service_radius=a.within_radius,
            score=a.score,
            score_breakdown=a.breakdown,
            reasons=a.reasons,
            limitations=a.limitations,
        )
        for w, a in scored[:limit]
    ]
    limitations = [] if has_coords else [NO_JOB_COORDINATES]
    if not candidates:
        limitations.append("No available worker currently matches this job's trade and location.")
    return MatchResponse(
        job_id=job.id,
        trade=Trade(job.trade),
        distance_matching="complete" if has_coords else "unavailable",
        limitations=limitations,
        scoring=SCORING_DESCRIPTION,
        candidates=candidates,
        excluded=excluded,
    )
