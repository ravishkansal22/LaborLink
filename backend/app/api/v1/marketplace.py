"""Phase 2 job routes: matching, offers and booking (mounted under /jobs/{job_id})."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_rate_card
from app.schemas.common import ErrorResponse
from app.schemas.marketplace import (
    BookingCreate,
    BookingResponse,
    JobOffersResponse,
    MatchResponse,
    OfferCreate,
    OfferResponse,
)
from app.schemas.pricing import RateCard
from app.services import bookings as booking_service
from app.services import offers as offer_service
from app.services.jobs import get_job
from app.services.matching import match_workers

router = APIRouter(prefix="/jobs", tags=["matching & booking"])

_E = {code: {"model": ErrorResponse} for code in (404, 409, 422, 503)}


@router.get("/{job_id}/matches", response_model=MatchResponse,
            responses=_E, summary="Ranked suitable workers for an open job")
def job_matches(
    job_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> MatchResponse:
    return match_workers(db, get_job(db, job_id), limit=limit)


@router.post("/{job_id}/offers", status_code=status.HTTP_201_CREATED,
             response_model=OfferResponse, responses=_E,
             summary="Worker accepts the suggested amount or makes a counter-offer")
def create_offer(
    job_id: str,
    payload: OfferCreate,
    db: Session = Depends(get_db),
    rate_card: RateCard = Depends(get_rate_card),
) -> OfferResponse:
    return offer_service.to_response(
        offer_service.create_offer(db, job_id, payload, card=rate_card)
    )


@router.get("/{job_id}/offers", response_model=JobOffersResponse,
            responses={404: _E[404], 503: _E[503]},
            summary="All offers for a job, with comparison context")
def job_offers(
    job_id: str,
    db: Session = Depends(get_db),
    rate_card: RateCard = Depends(get_rate_card),
) -> JobOffersResponse:
    return offer_service.list_job_offers(db, job_id, card=rate_card)


@router.post("/{job_id}/bookings", status_code=status.HTTP_201_CREATED,
             response_model=BookingResponse, responses=_E,
             summary="Employer selects an offer and confirms the booking")
def confirm_booking(
    job_id: str,
    payload: BookingCreate,
    db: Session = Depends(get_db),
    rate_card: RateCard = Depends(get_rate_card),
) -> BookingResponse:
    return booking_service.to_response(
        booking_service.confirm_booking(db, job_id, payload, card=rate_card)
    )


@router.get("/{job_id}/booking", response_model=BookingResponse,
            responses={404: _E[404], 503: _E[503]}, summary="The job's confirmed booking")
def job_booking(job_id: str, db: Session = Depends(get_db)) -> BookingResponse:
    return booking_service.to_response(booking_service.get_booking(db, job_id))
