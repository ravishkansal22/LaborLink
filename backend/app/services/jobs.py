"""Job intake workflow: work-order generation, FairRate pricing and persistence."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from app.db import utcnow
from app.errors import InvalidReferenceError, NotFoundError
from app.models import ImageUpload, Job, PriceEstimateRecord, WorkOrderRecord
from app.schemas.common import JobStatus, Trade, Urgency
from app.schemas.jobs import JobCreate, JobRequestDetails, JobResponse, Location
from app.schemas.pricing import PriceEstimate, RateCard
from app.schemas.work_order import WorkOrderV1
from app.services.db_guard import db_guard
from app.services.lifecycle import JobNotOpenError, TradeRequiredError, ensure_transition
from app.services.pricing import calculate_estimate
from app.services.translation import TranslationService
from app.services.work_orders import ImageInput, WorkOrderInput, WorkOrderService
from app.services.work_orders.rule_based import normalize_description, summarize_description

__all__ = ["TradeRequiredError", "create_job", "get_job", "recalculate_estimate", "to_response"]


def pricing_warnings(work_order: WorkOrderV1) -> list[str]:
    """Warnings derived from how certain the work order is."""
    warnings: list[str] = []
    if work_order.trade_source == "inferred" and work_order.trade_confidence == "low":
        warnings.append("The trade was inferred with low confidence; please confirm it.")
    if work_order.classification_confidence == "low":
        warnings.append(
            "The specific problem is unclear, so the range is based on a generic job of this "
            "trade and may change after inspection."
        )
    if work_order.image_assessment.status == "not_analysed":
        warnings.append("The photo was not analysed; the estimate uses the text description only.")
    if work_order.missing_information:
        warnings.append(
            "Estimated without: " + "; ".join(work_order.missing_information) + "."
        )
    return warnings


def _estimate_for(work_order: WorkOrderV1, urgency: Urgency, card: RateCard) -> PriceEstimate:
    if work_order.suggested_trade is None:
        raise TradeRequiredError("A trade is required to calculate a price estimate.")
    return calculate_estimate(
        card,
        trade=work_order.suggested_trade,
        complexity=work_order.complexity,
        urgency=urgency,
        duration=work_order.estimated_duration,
        context_warnings=pricing_warnings(work_order),
    )


def _estimate_record(estimate: PriceEstimate, sequence: int) -> PriceEstimateRecord:
    return PriceEstimateRecord(
        sequence=sequence,
        rate_card_version=estimate.rate_card_version,
        currency=estimate.currency,
        min_amount=estimate.min_amount,
        max_amount=estimate.max_amount,
        payload=estimate.model_dump(mode="json", exclude={"id", "created_at"}),
    )


def estimate_from_record(record: PriceEstimateRecord) -> PriceEstimate:
    return PriceEstimate.model_validate(
        {**record.payload, "id": record.id, "created_at": record.created_at}
    )


def create_job(
    session: Session,
    payload: JobCreate,
    *,
    work_orders: WorkOrderService,
    rate_card: RateCard,
    upload_dir: Path,
    translator: TranslationService | None = None,
) -> Job:
    image: ImageUpload | None = None
    if payload.image_id is not None:
        with db_guard(session):
            image = session.get(ImageUpload, payload.image_id)
        if image is None:
            raise InvalidReferenceError(
                f"image_id '{payload.image_id}' does not refer to an uploaded image."
            )

    # Descriptions in an Indian script are translated to English for the keyword engine;
    # the employer's original text is what gets stored and shown.
    english = (
        translator.to_english(session, payload.description, payload.language)
        if translator else None
    )
    data = WorkOrderInput(
        description=english or payload.description,
        description_source=payload.description_source,
        language=payload.language,
        trade=payload.trade,
        urgency=payload.urgency,
        has_coordinates=payload.location.has_coordinates,
        image=ImageInput(upload_dir / image.stored_filename, image.content_type) if image else None,
    )
    # Generated before any write: a provider failure can never leave a partial job behind.
    work_order = work_orders.generate(data)
    if english:
        # The title stays in the employer's own words; viewers' apps translate it for display.
        original = normalize_description(payload.description)
        summary = summarize_description(original)
        work_order = work_order.model_copy(update={"problem_summary": summary})

    job = Job(
        description=payload.description,
        description_source=payload.description_source,
        language=payload.language,
        requested_trade=payload.trade.value if payload.trade else None,
        trade=work_order.suggested_trade.value if work_order.suggested_trade else None,
        urgency=payload.urgency.value,
        address=payload.location.address,
        latitude=payload.location.latitude,
        longitude=payload.location.longitude,
        image_id=image.id if image else None,
        employer_ref=payload.employer_id,
        status=JobStatus.needs_information.value,
    )
    job.work_order = WorkOrderRecord(
        schema_version=work_order.schema_version,
        provider=work_order.generator.provider,
        payload=work_order.model_dump(mode="json"),
    )
    if work_order.suggested_trade is not None:
        estimate = _estimate_for(work_order, payload.urgency, rate_card)
        job.price_estimates.append(_estimate_record(estimate, sequence=1))
        job.status = JobStatus.estimated.value

    with db_guard(session):
        session.add(job)
        session.commit()
    return job


def get_job(session: Session, job_id: str) -> Job:
    with db_guard(session):
        job = session.get(Job, job_id)
        if job is not None:
            # Load relationships while the guard is active.
            _ = job.work_order, job.price_estimates, job.image
    if job is None:
        raise NotFoundError(f"Job '{job_id}' was not found.")
    return job


def recalculate_estimate(session: Session, job_id: str, *, rate_card: RateCard) -> PriceEstimate:
    job = get_job(session, job_id)
    if job.trade is None or job.work_order is None:
        raise TradeRequiredError(
            "This job has no trade yet, so it cannot be priced. Create the job again with a "
            "trade selected."
        )
    if job.status != JobStatus.estimated.value:
        # A booked job keeps the estimate its booking was agreed against.
        raise JobNotOpenError(
            f"Job '{job.id}' is '{job.status}'; its estimate can no longer be recalculated."
        )
    ensure_transition(job, JobStatus.estimated)
    work_order = WorkOrderV1.model_validate(job.work_order.payload)
    estimate = _estimate_for(work_order, Urgency(job.urgency), rate_card)
    record = _estimate_record(estimate, sequence=len(job.price_estimates) + 1)
    with db_guard(session):
        job.price_estimates.append(record)
        job.status = JobStatus.estimated.value
        job.updated_at = utcnow()
        session.commit()
    return estimate_from_record(record)


def to_response(job: Job) -> JobResponse:
    current = job.current_estimate
    return JobResponse(
        id=job.id,
        status=JobStatus(job.status),
        trade=Trade(job.trade) if job.trade else None,
        employer_id=job.employer_ref,
        request=JobRequestDetails(
            description=job.description,
            description_source=job.description_source,
            language=job.language,
            requested_trade=Trade(job.requested_trade) if job.requested_trade else None,
            urgency=Urgency(job.urgency),
            location=Location.model_construct(
                address=job.address, latitude=job.latitude, longitude=job.longitude
            ),
            image_id=job.image_id,
        ),
        work_order=WorkOrderV1.model_validate(job.work_order.payload),
        price_estimate=estimate_from_record(current) if current else None,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )
