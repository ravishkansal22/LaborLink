from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_rate_card, get_settings, get_work_order_service
from app.config import Settings
from app.schemas.common import ErrorResponse
from app.schemas.jobs import JobCreate, JobResponse
from app.schemas.pricing import PriceEstimate, RateCard
from app.services import jobs as job_service
from app.services.work_orders import WorkOrderService

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=JobResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Create a job: structured work order + indicative FairRate estimate",
)
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    work_orders: WorkOrderService = Depends(get_work_order_service),
    rate_card: RateCard = Depends(get_rate_card),
    settings: Settings = Depends(get_settings),
) -> JobResponse:
    job = job_service.create_job(
        db, payload, work_orders=work_orders, rate_card=rate_card,
        upload_dir=settings.upload_path,
    )
    return job_service.to_response(job)


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Retrieve a job with its work order and current estimate",
)
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobResponse:
    return job_service.to_response(job_service.get_job(db, job_id))


@router.post(
    "/{job_id}/price-estimate",
    response_model=PriceEstimate,
    responses={
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
    summary="Recalculate the estimate from the persisted job and the current rate card",
)
def recalculate_price(
    job_id: str,
    db: Session = Depends(get_db),
    rate_card: RateCard = Depends(get_rate_card),
) -> PriceEstimate:
    return job_service.recalculate_estimate(db, job_id, rate_card=rate_card)
