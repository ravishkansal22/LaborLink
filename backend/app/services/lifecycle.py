"""Job lifecycle rules (single source of truth for job status transitions).

    needs_information ──(no transitions; create the job again with a trade)
    estimated ──recalculate──▶ estimated
    estimated ──confirm booking──▶ booked
    booked ──worker starts──▶ in_progress
    in_progress ──worker submits evidence──▶ awaiting_confirmation
    awaiting_confirmation ──employer confirms──▶ completed      (simulated settlement allowed)
    awaiting_confirmation ──employer disputes──▶ disputed       (never settled; resolution deferred)

Only `estimated` jobs are open: they appear in worker discovery, can be matched, receive offers
and be booked. `completed` and `disputed` are terminal in Phase 3.
"""

from __future__ import annotations

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.db import utcnow
from app.errors import AppError, ConflictError
from app.models import Job
from app.schemas.common import JobStatus

ALLOWED_TRANSITIONS: dict[JobStatus, frozenset[JobStatus]] = {
    JobStatus.needs_information: frozenset(),
    JobStatus.estimated: frozenset({JobStatus.estimated, JobStatus.booked}),
    JobStatus.booked: frozenset({JobStatus.in_progress}),
    JobStatus.in_progress: frozenset({JobStatus.awaiting_confirmation}),
    JobStatus.awaiting_confirmation: frozenset({JobStatus.completed, JobStatus.disputed}),
    JobStatus.completed: frozenset(),
    JobStatus.disputed: frozenset(),
}

OPEN_STATUSES = frozenset({JobStatus.estimated})
# Every status reached after a booking was confirmed.
BOOKED_STATUSES = frozenset({
    JobStatus.booked,
    JobStatus.in_progress,
    JobStatus.awaiting_confirmation,
    JobStatus.completed,
    JobStatus.disputed,
})


class TradeRequiredError(ConflictError):
    code = "trade_required"


class JobNotOpenError(ConflictError):
    code = "job_not_open"


class InvalidTransitionError(ConflictError):
    code = "invalid_status_transition"


def can_transition(current: JobStatus, new: JobStatus) -> bool:
    return new in ALLOWED_TRANSITIONS[current]


def ensure_transition(job: Job, new: JobStatus) -> None:
    current = JobStatus(job.status)
    if not can_transition(current, new):
        raise InvalidTransitionError(
            f"Job '{job.id}' cannot move from '{current.value}' to '{new.value}'.",
            details=[{"current_status": current.value, "requested_status": new.value}],
        )


def apply_transition(session: Session, job: Job, new: JobStatus) -> None:
    """Move `job` to `new` inside the caller's transaction, atomically.

    The UPDATE only matches if the row still has the status we validated against, so a
    concurrent request that changed it first makes this one fail instead of overwriting it.
    The caller must be inside `db_guard` and commit (or roll back) afterwards.
    """
    ensure_transition(job, new)
    expected = job.status
    now = utcnow()
    changed = session.execute(
        update(Job)
        .where(Job.id == job.id, Job.status == expected)
        .values(status=new.value, updated_at=now)
        .execution_options(synchronize_session=False)
    ).rowcount
    if changed != 1:
        session.rollback()
        raise InvalidTransitionError(
            f"Job '{job.id}' changed state concurrently; reload it and retry.",
            details=[{"expected_status": expected, "requested_status": new.value}],
        )
    job.status = new.value
    job.updated_at = now


def require_open(job: Job) -> None:
    """Raise unless the job is open for matching, offers and booking."""
    status = JobStatus(job.status)
    if status in OPEN_STATUSES:
        return
    error: AppError
    if status is JobStatus.needs_information:
        error = TradeRequiredError(
            "This job has no trade yet, so it cannot be matched, offered on or booked."
        )
    else:
        error = JobNotOpenError(f"Job '{job.id}' is '{status.value}' and no longer open.")
    raise error
