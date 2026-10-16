"""Job execution: the booked worker starts the job and submits completion evidence."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ConflictError, InvalidReferenceError, NotFoundError
from app.models import (
    Booking,
    CompletionEvidence,
    CompletionEvidenceImage,
    ImageUpload,
    Job,
    JobExecution,
)
from app.schemas.common import JobStatus
from app.schemas.completion import (
    EvidenceCreate,
    EvidenceImage,
    EvidenceResponse,
    JobExecutionResponse,
    JobStartRequest,
)
from app.services.actors import require_booked_worker
from app.services.db_guard import db_guard
from app.services.jobs import get_job
from app.services.lifecycle import InvalidTransitionError, apply_transition, ensure_transition


class JobNotBookedError(ConflictError):
    code = "job_not_booked"


class JobNotStartedError(ConflictError):
    code = "job_not_started"


class EvidenceAlreadySubmittedError(ConflictError):
    code = "evidence_already_submitted"


def booking_for(session: Session, job: Job) -> Booking:
    with db_guard(session):
        booking = session.scalars(select(Booking).where(Booking.job_id == job.id)).first()
    if booking is None:
        raise JobNotBookedError(f"Job '{job.id}' has no confirmed booking.")
    return booking


def start_job(session: Session, job_id: str, payload: JobStartRequest) -> JobExecution:
    job = get_job(session, job_id)
    booking = booking_for(session, job)
    require_booked_worker(booking, payload.worker_id)
    ensure_transition(job, JobStatus.in_progress)  # e.g. starting twice -> 409

    execution = JobExecution(job_id=job.id, booking_id=booking.id, worker_id=booking.worker_id)
    with db_guard(session, on_integrity_error=lambda: InvalidTransitionError(
        f"Job '{job.id}' has already been started."
    )):
        apply_transition(session, job, JobStatus.in_progress)
        session.add(execution)
        session.commit()
    return execution


def execution_response(execution: JobExecution, job: Job) -> JobExecutionResponse:
    return JobExecutionResponse(
        job_id=job.id,
        job_status=JobStatus(job.status),
        booking_id=execution.booking_id,
        worker_id=execution.worker_id,
        started_at=execution.started_at,
    )


def submit_evidence(session: Session, job_id: str, payload: EvidenceCreate) -> CompletionEvidence:
    job = get_job(session, job_id)
    booking = booking_for(session, job)
    require_booked_worker(booking, payload.worker_id)

    status = JobStatus(job.status)
    if status is JobStatus.booked:
        raise JobNotStartedError("The job must be started before completion evidence is submitted.")
    if status is not JobStatus.in_progress:
        raise EvidenceAlreadySubmittedError(
            "Completion evidence has already been submitted for this job and cannot be replaced.",
            details=[{"job_status": status.value}],
        )

    wanted = [*payload.before_image_ids, *payload.after_image_ids]
    with db_guard(session):
        found = set(session.scalars(select(ImageUpload.id).where(ImageUpload.id.in_(wanted))))
    missing = [i for i in wanted if i not in found]
    if missing:
        raise InvalidReferenceError(
            "Some image ids do not refer to uploaded images "
            "(upload them with POST /api/v1/images).",
            details=[{"missing_image_ids": missing}],
        )

    evidence = CompletionEvidence(
        job_id=job.id, booking_id=booking.id, worker_id=booking.worker_id, note=payload.note
    )
    for role, ids in (("before", payload.before_image_ids), ("after", payload.after_image_ids)):
        for position, image_id in enumerate(ids):
            evidence.images.append(
                CompletionEvidenceImage(image_id=image_id, role=role, position=position)
            )
    with db_guard(session, on_integrity_error=lambda: EvidenceAlreadySubmittedError(
        "Completion evidence has already been submitted for this job."
    )):
        apply_transition(session, job, JobStatus.awaiting_confirmation)
        session.add(evidence)
        session.commit()
    return evidence


def get_evidence(session: Session, job_id: str) -> tuple[CompletionEvidence, Job]:
    job = get_job(session, job_id)
    with db_guard(session):
        evidence = session.scalars(
            select(CompletionEvidence).where(CompletionEvidence.job_id == job.id)
        ).first()
        if evidence is not None:
            _ = [link.image for link in evidence.images]
    if evidence is None:
        raise NotFoundError(f"Job '{job.id}' has no completion evidence yet.")
    return evidence, job


def evidence_response(evidence: CompletionEvidence, job: Job) -> EvidenceResponse:
    def images(role: str) -> list[EvidenceImage]:
        return [
            EvidenceImage(image_id=link.image.id, content_type=link.image.content_type,
                          size_bytes=link.image.size_bytes, sha256=link.image.sha256)
            for link in sorted(evidence.images, key=lambda x: x.position)
            if link.role == role
        ]

    return EvidenceResponse(
        id=evidence.id,
        job_id=evidence.job_id,
        booking_id=evidence.booking_id,
        worker_id=evidence.worker_id,
        before_images=images("before"),
        after_images=images("after"),
        note=evidence.note,
        submitted_at=evidence.submitted_at,
        job_status=JobStatus(job.status),
    )
