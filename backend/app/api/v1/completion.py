"""Phase 3 job routes: start, completion evidence, employer review and simulated settlement.

No authentication: worker_id / employer_id in request bodies are self-asserted prototype labels.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.common import ErrorResponse
from app.schemas.completion import (
    CompletionDecisionRequest,
    CompletionReviewResponse,
    EvidenceCreate,
    EvidenceResponse,
    JobExecutionResponse,
    JobStartRequest,
    SettlementRequest,
    SettlementResponse,
)
from app.services import execution, settlements
from app.services.jobs import get_job

router = APIRouter(prefix="/jobs", tags=["completion & settlement"])

_E = {code: {"model": ErrorResponse} for code in (403, 404, 409, 422, 503)}
_READ = {404: _E[404], 503: _E[503]}


@router.post("/{job_id}/start", response_model=JobExecutionResponse, responses=_E,
             summary="Booked worker marks the job as started (booked → in_progress)")
def start_job(job_id: str, payload: JobStartRequest,
              db: Session = Depends(get_db)) -> JobExecutionResponse:
    record = execution.start_job(db, job_id, payload)
    return execution.execution_response(record, get_job(db, job_id))


@router.post("/{job_id}/completion-evidence", status_code=status.HTTP_201_CREATED,
             response_model=EvidenceResponse, responses=_E,
             summary="Booked worker submits before/after photos (in_progress → "
                     "awaiting_confirmation)")
def submit_evidence(job_id: str, payload: EvidenceCreate,
                    db: Session = Depends(get_db)) -> EvidenceResponse:
    execution.submit_evidence(db, job_id, payload)
    return execution.evidence_response(*execution.get_evidence(db, job_id))


@router.get("/{job_id}/completion-evidence", response_model=EvidenceResponse, responses=_READ,
            summary="Completion evidence for employer review")
def get_evidence(job_id: str, db: Session = Depends(get_db)) -> EvidenceResponse:
    return execution.evidence_response(*execution.get_evidence(db, job_id))


@router.post("/{job_id}/completion-confirmation", status_code=status.HTTP_201_CREATED,
             response_model=CompletionReviewResponse, responses=_E,
             summary="Employer confirms (→ completed, simulated settlement pending) or disputes "
                     "(→ disputed, never settled)")
def review_completion(job_id: str, payload: CompletionDecisionRequest,
                      db: Session = Depends(get_db)) -> CompletionReviewResponse:
    return settlements.review_response(*settlements.review_completion(db, job_id, payload))


@router.post("/{job_id}/settlement", response_model=SettlementResponse, responses=_E,
             summary="Record the simulated settlement (simulated_pending → simulated_settled)")
def settle(job_id: str, payload: SettlementRequest,
           db: Session = Depends(get_db)) -> SettlementResponse:
    return settlements.settlement_response(settlements.settle(db, job_id, payload))


@router.get("/{job_id}/settlement", response_model=SettlementResponse, responses=_READ,
            summary="The job's simulated settlement record")
def get_settlement(job_id: str, db: Session = Depends(get_db)) -> SettlementResponse:
    return settlements.settlement_response(settlements.get_settlement(db, job_id))
