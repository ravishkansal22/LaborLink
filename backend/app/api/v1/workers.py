from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_rate_card
from app.schemas.common import ErrorResponse
from app.schemas.completion import PassbookResponse
from app.schemas.marketplace import OpportunitiesResponse, WorkerOffersResponse
from app.schemas.pricing import RateCard
from app.schemas.workers import WorkerCreate, WorkerResponse, WorkerUpdate
from app.services import offers as offer_service
from app.services import workers as worker_service
from app.services.discovery import discover_jobs
from app.services.passbook import build_passbook

router = APIRouter(prefix="/workers", tags=["workers"])

_NOT_FOUND = {404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}}


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=WorkerResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Create a (self-declared, unverified) worker profile",
)
def create_worker(payload: WorkerCreate, db: Session = Depends(get_db)) -> WorkerResponse:
    return worker_service.to_response(worker_service.create_worker(db, payload))


@router.get("/{worker_id}", response_model=WorkerResponse, responses=_NOT_FOUND,
            summary="Retrieve a worker profile")
def get_worker(worker_id: str, db: Session = Depends(get_db)) -> WorkerResponse:
    return worker_service.to_response(worker_service.get_worker(db, worker_id))


@router.patch(
    "/{worker_id}",
    response_model=WorkerResponse,
    responses={**_NOT_FOUND, 422: {"model": ErrorResponse}},
    summary="Update profile details or availability (partial update)",
)
def update_worker(
    worker_id: str, payload: WorkerUpdate, db: Session = Depends(get_db)
) -> WorkerResponse:
    return worker_service.to_response(worker_service.update_worker(db, worker_id, payload))


@router.get(
    "/{worker_id}/jobs",
    response_model=OpportunitiesResponse,
    responses=_NOT_FOUND,
    summary="Open jobs matching the worker's trades and service area",
)
def worker_jobs(
    worker_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    rate_card: RateCard = Depends(get_rate_card),
) -> OpportunitiesResponse:
    return discover_jobs(db, worker_id, card=rate_card, limit=limit)


@router.get("/{worker_id}/offers", response_model=WorkerOffersResponse, responses=_NOT_FOUND,
            summary="Offers made by the worker, newest first")
def worker_offers(worker_id: str, db: Session = Depends(get_db)) -> WorkerOffersResponse:
    return offer_service.list_worker_offers(db, worker_id)


@router.get("/{worker_id}/passbook", response_model=PassbookResponse, responses=_NOT_FOUND,
            summary="Kamai Passbook: work and (simulated) earnings history")
def worker_passbook(
    worker_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    rate_card: RateCard = Depends(get_rate_card),
) -> PassbookResponse:
    return build_passbook(db, worker_id, default_currency=rate_card.currency, limit=limit)
