"""Worker profile persistence."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.errors import NotFoundError
from app.models import Worker
from app.schemas.common import Availability, Trade
from app.schemas.workers import (
    WorkerCreate,
    WorkerLocation,
    WorkerResponse,
    WorkerSummary,
    WorkerUpdate,
)
from app.services.db_guard import db_guard


def create_worker(session: Session, payload: WorkerCreate) -> Worker:
    worker = Worker(
        display_name=payload.display_name,
        trades=[t.value for t in payload.trades],
        years_experience=payload.years_experience,
        latitude=payload.location.latitude,
        longitude=payload.location.longitude,
        locality=payload.location.locality,
        service_radius_km=payload.service_radius_km,
        availability=payload.availability.value,
    )
    with db_guard(session):
        session.add(worker)
        session.commit()
    return worker


def get_worker(session: Session, worker_id: str) -> Worker:
    with db_guard(session):
        worker = session.get(Worker, worker_id)
    if worker is None:
        raise NotFoundError(f"Worker '{worker_id}' was not found.")
    return worker


def update_worker(session: Session, worker_id: str, payload: WorkerUpdate) -> Worker:
    worker = get_worker(session, worker_id)
    fields = payload.model_fields_set
    if "display_name" in fields:
        worker.display_name = payload.display_name
    if "trades" in fields:
        worker.trades = [t.value for t in payload.trades]
    if "years_experience" in fields:
        worker.years_experience = payload.years_experience
    if "location" in fields:
        worker.latitude = payload.location.latitude
        worker.longitude = payload.location.longitude
        worker.locality = payload.location.locality
    if "service_radius_km" in fields:
        worker.service_radius_km = payload.service_radius_km
    if "availability" in fields:
        worker.availability = payload.availability.value
    with db_guard(session):
        session.commit()
    return worker


def worker_trades(worker: Worker) -> list[Trade]:
    return [Trade(t) for t in worker.trades]


def to_summary(worker: Worker) -> WorkerSummary:
    return WorkerSummary(
        id=worker.id,
        display_name=worker.display_name,
        trades=worker_trades(worker),
        years_experience=worker.years_experience,
    )


def to_response(worker: Worker) -> WorkerResponse:
    return WorkerResponse(
        id=worker.id,
        display_name=worker.display_name,
        trades=worker_trades(worker),
        years_experience=worker.years_experience,
        location=WorkerLocation(
            latitude=worker.latitude, longitude=worker.longitude, locality=worker.locality
        ),
        service_radius_km=worker.service_radius_km,
        availability=Availability(worker.availability),
        created_at=worker.created_at,
        updated_at=worker.updated_at,
    )

from sqlalchemy import select


def find_nearby_workers(
    session: Session,
    lat: float,
    lon: float,
    *,
    trade: Trade | None = None,
    max_radius_km: float = 25.0,
    limit: int = 10,
) -> list[dict]:
    from app.services.matching import haversine_km
    stmt = select(Worker).where(Worker.availability == "available")
    workers = session.execute(stmt).scalars().all()

    results = []
    for w in workers:
        if trade and trade.value not in w.trades:
            continue
        dist = haversine_km(lat, lon, w.latitude, w.longitude)
        if dist <= max_radius_km and dist <= w.service_radius_km:
            results.append({
                "id": w.id,
                "display_name": w.display_name,
                "trades": [Trade(t) for t in w.trades],
                "years_experience": w.years_experience,
                "distance_km": round(dist, 2),
                "locality": w.locality,
                "availability": Availability(w.availability),
            })

    results.sort(key=lambda x: x["distance_km"])
    return results[:limit]