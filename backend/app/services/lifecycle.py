"""Job lifecycle rules.

    needs_information ──(no transition in Phase 2; create the job again with a trade)
    estimated ──recalculate──▶ estimated
    estimated ──confirm booking──▶ booked
    booked ──▶ (Phase 3: in_progress, completed — not implemented)

Only `estimated` jobs are open: they appear in worker discovery, can be matched, receive offers
and be booked.
"""

from __future__ import annotations

from app.errors import AppError, ConflictError
from app.models import Job
from app.schemas.common import JobStatus

ALLOWED_TRANSITIONS: dict[JobStatus, frozenset[JobStatus]] = {
    JobStatus.needs_information: frozenset(),
    JobStatus.estimated: frozenset({JobStatus.estimated, JobStatus.booked}),
    JobStatus.booked: frozenset(),
}

OPEN_STATUSES = frozenset({JobStatus.estimated})


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
            f"Job '{job.id}' cannot move from '{current.value}' to '{new.value}'."
        )


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
