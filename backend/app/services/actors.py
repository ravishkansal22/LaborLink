"""Actor checks for the local prototype.

There is NO authentication. `worker_id` and `employer_id` in request bodies are self-asserted
labels: these checks keep the demo workflow consistent (the booked worker starts the job, the
job's employer confirms it), but anyone who knows an id can send it. Production use requires
real authentication and authorisation.
"""

from __future__ import annotations

from app.errors import AppError, ConflictError
from app.models import Booking, Job

EMPLOYER_ID_PATTERN = r"^[A-Za-z0-9_.:@-]{1,64}$"


class ActorMismatchError(AppError):
    status_code = 403
    code = "actor_mismatch"


class EmployerNotRecordedError(ConflictError):
    code = "employer_not_recorded"


def require_booked_worker(booking: Booking, worker_id: str) -> None:
    if booking.worker_id != worker_id:
        raise ActorMismatchError(
            "Only the worker assigned to this booking can perform this action "
            "(prototype check on the supplied worker_id; not authentication)."
        )


def require_job_employer(job: Job, employer_id: str) -> None:
    if job.employer_ref is None:
        raise EmployerNotRecordedError(
            "This job has no recorded employer_id. Provide employer_id when creating the job "
            "or when confirming the booking."
        )
    if job.employer_ref != employer_id:
        raise ActorMismatchError(
            "Only the employer recorded for this job can perform this action "
            "(prototype check on the supplied employer_id; not authentication)."
        )
