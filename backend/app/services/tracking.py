"""Live location of the booked worker, shown to the employer with an approximate arrival time.

Sharing is only possible while the job is `booked` (worker travelling) or `in_progress` (on site).
Only the latest position is stored. The ETA is a simple estimate, not a routed one:
straight-line distance x ROAD_FACTOR at AVERAGE_SPEED_KMH.
"""

from __future__ import annotations

import math

from sqlalchemy.orm import Session

from app.db import utcnow
from app.errors import ConflictError
from app.models import Booking, Job, WorkerLocation
from app.schemas.common import JobStatus
from app.schemas.tracking import Destination, LocationUpdate, SharedLocation, TrackingView
from app.services.actors import require_booked_worker, require_job_employer
from app.services.db_guard import db_guard
from app.services.execution import booking_for
from app.services.jobs import get_job
from app.services.matching import haversine_km

TRACKABLE = frozenset({JobStatus.booked, JobStatus.in_progress})
ROAD_FACTOR = 1.3          # roads are longer than a straight line
AVERAGE_SPEED_KMH = 20.0   # typical city two-wheeler speed in traffic
ARRIVED_WITHIN_KM = 0.15
STALE_AFTER_SECONDS = 120
ETA_BASIS = (
    f"Approximate: straight-line distance x {ROAD_FACTOR} at {AVERAGE_SPEED_KMH:g} km/h city "
    "speed. It is not a routed or traffic-aware estimate."
)
NO_COORDINATES = "The job has no map coordinates, so distance and arrival time cannot be estimated."


class TrackingNotActiveError(ConflictError):
    code = "tracking_not_active"


def _require_trackable(job: Job) -> None:
    if JobStatus(job.status) not in TRACKABLE:
        raise TrackingNotActiveError(
            "Live location is only shared while the worker is on the way or on site.",
            details=[{"job_status": job.status}],
        )


def eta_minutes(distance_km: float) -> int:
    return max(1, math.ceil(distance_km * ROAD_FACTOR / AVERAGE_SPEED_KMH * 60))


def _view(job: Job, booking: Booking, location: WorkerLocation | None) -> TrackingView:
    destination = None
    if job.latitude is not None and job.longitude is not None:
        destination = Destination(
            latitude=job.latitude, longitude=job.longitude, address=job.address
        )

    shared = None
    distance = None
    eta = None
    arrived = JobStatus(job.status) is JobStatus.in_progress
    if location is not None:
        age = max(0, int((utcnow() - location.recorded_at).total_seconds()))
        shared = SharedLocation(
            latitude=location.latitude,
            longitude=location.longitude,
            accuracy_m=location.accuracy_m,
            recorded_at=location.recorded_at,
            age_seconds=age,
            stale=age > STALE_AFTER_SECONDS,
        )
        if destination is not None:
            distance = round(haversine_km(location.latitude, location.longitude,
                                          destination.latitude, destination.longitude), 2)
            arrived = arrived or distance <= ARRIVED_WITHIN_KM
            eta = 0 if arrived else eta_minutes(distance)

    return TrackingView(
        job_id=job.id,
        job_status=JobStatus(job.status),
        worker_id=booking.worker_id,
        worker_name=booking.worker.display_name,
        worker_location=shared,
        destination=destination,
        distance_km=distance,
        eta_minutes=eta,
        arrived=arrived,
        eta_basis=ETA_BASIS if destination is not None else NO_COORDINATES,
    )


def share_location(session: Session, job_id: str, payload: LocationUpdate) -> TrackingView:
    job = get_job(session, job_id)
    booking = booking_for(session, job)
    require_booked_worker(booking, payload.worker_id)
    _require_trackable(job)
    with db_guard(session):
        location = session.get(WorkerLocation, job.id)
        if location is None:
            location = WorkerLocation(job_id=job.id, worker_id=booking.worker_id)
            session.add(location)
        location.latitude = payload.latitude
        location.longitude = payload.longitude
        location.accuracy_m = payload.accuracy_m
        location.recorded_at = utcnow()
        session.commit()
        _ = booking.worker
    return _view(job, booking, location)


def get_tracking(session: Session, job_id: str, employer_id: str) -> TrackingView:
    job = get_job(session, job_id)
    booking = booking_for(session, job)
    require_job_employer(job, employer_id)
    _require_trackable(job)
    with db_guard(session):
        location = session.get(WorkerLocation, job.id)
        _ = booking.worker
    return _view(job, booking, location)
