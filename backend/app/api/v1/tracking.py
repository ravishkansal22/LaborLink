"""Live worker location for a booked job (no authentication: actor ids are prototype labels)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.common import ErrorResponse
from app.schemas.tracking import LocationUpdate, TrackingView
from app.services import tracking

router = APIRouter(prefix="/jobs", tags=["live tracking"])

_E = {code: {"model": ErrorResponse} for code in (403, 404, 409, 422, 503)}


@router.post("/{job_id}/worker-location", response_model=TrackingView, responses=_E,
             summary="Booked worker shares their current position (replaces the previous one)")
def share_location(
    job_id: str, payload: LocationUpdate, db: Session = Depends(get_db)
) -> TrackingView:
    return tracking.share_location(db, job_id, payload)


@router.get("/{job_id}/worker-location", response_model=TrackingView, responses=_E,
            summary="Employer sees the worker's latest position and approximate arrival time")
def get_location(
    job_id: str,
    employer_id: str = Query(pattern=r"^[A-Za-z0-9_.:@-]{1,64}$"),
    db: Session = Depends(get_db),
) -> TrackingView:
    return tracking.get_tracking(db, job_id, employer_id)
