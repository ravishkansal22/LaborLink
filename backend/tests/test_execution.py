"""Phase 3: starting a job and submitting completion evidence."""

import pytest

from app.models import CompletionEvidence, Job, JobExecution
from app.schemas.common import JobStatus
from app.services.lifecycle import ALLOWED_TRANSITIONS, can_transition


def _status(client, job_id):
    return client.get(f"/api/v1/jobs/{job_id}").json()["status"]


# --- lifecycle table ---------------------------------------------------------------------------

def test_transition_table_matches_documented_flow():
    assert can_transition(JobStatus.booked, JobStatus.in_progress)
    assert can_transition(JobStatus.in_progress, JobStatus.awaiting_confirmation)
    assert can_transition(JobStatus.awaiting_confirmation, JobStatus.completed)
    assert can_transition(JobStatus.awaiting_confirmation, JobStatus.disputed)
    assert ALLOWED_TRANSITIONS[JobStatus.completed] == frozenset()
    assert ALLOWED_TRANSITIONS[JobStatus.disputed] == frozenset()
    for bad in [(JobStatus.estimated, JobStatus.in_progress),
                (JobStatus.booked, JobStatus.completed),
                (JobStatus.in_progress, JobStatus.completed),
                (JobStatus.disputed, JobStatus.completed),
                (JobStatus.completed, JobStatus.completed)]:
        assert not can_transition(*bad)
    assert set(ALLOWED_TRANSITIONS) == set(JobStatus)


# --- start -------------------------------------------------------------------------------------

def test_valid_start(client, booked_job, flow):
    ctx = booked_job()
    resp = flow.start(ctx)
    assert resp.status_code == 200
    body = resp.json()
    assert body["job_status"] == "in_progress"
    assert body["booking_id"] == ctx["booking"]["id"] and body["worker_id"] == ctx["worker_id"]
    assert _status(client, ctx["job_id"]) == "in_progress"


def test_start_without_booking(client, make_job, make_worker, flow):
    job, w = make_job(), make_worker()
    resp = flow.start({"job_id": job["id"], "worker_id": w["id"]})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "job_not_booked"
    assert _status(client, job["id"]) == "estimated"


def test_start_twice(client, booked_job, flow):
    ctx = booked_job()
    assert flow.start(ctx).status_code == 200
    resp = flow.start(ctx)
    assert resp.status_code == 409
    err = resp.json()["error"]
    assert err["code"] == "invalid_status_transition"
    assert err["details"][0]["current_status"] == "in_progress"
    with client.app.state.session_factory() as s:
        assert s.query(JobExecution).count() == 1


def test_only_booked_worker_can_start(client, booked_job, make_worker, flow):
    ctx = booked_job()
    other = make_worker(display_name="Other")
    resp = flow.start(ctx, worker_id=other["id"])
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "actor_mismatch"
    assert _status(client, ctx["job_id"]) == "booked"


def test_start_errors(client, booked_job, flow):
    assert flow.start({"job_id": "nope", "worker_id": "w"}).status_code == 404
    ctx = booked_job()
    resp = client.post(f"/api/v1/jobs/{ctx['job_id']}/start", json={})
    assert resp.status_code == 422


def test_completed_job_cannot_restart(client, booked_job, flow):
    ctx = flow.to_completed(booked_job())
    resp = flow.start(ctx)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "invalid_status_transition"


# --- evidence ----------------------------------------------------------------------------------

def test_valid_evidence_submission_and_retrieval(client, booked_job, flow, upload_image):
    ctx = booked_job()
    flow.start(ctx)
    before, after1, after2 = upload_image(), upload_image(), upload_image()
    resp = flow.evidence(ctx, before_image_ids=[before], after_image_ids=[after1, after2],
                         note="  Replaced washer and resealed.  ")
    assert resp.status_code == 201
    ev = resp.json()
    assert ev["job_status"] == "awaiting_confirmation"
    assert [i["image_id"] for i in ev["before_images"]] == [before]
    assert [i["image_id"] for i in ev["after_images"]] == [after1, after2]
    assert ev["after_images"][0]["content_type"] == "image/png"
    assert ev["note"] == "Replaced washer and resealed."
    assert ev["worker_id"] == ctx["worker_id"] and ev["booking_id"] == ctx["booking"]["id"]
    assert "do not prove" in ev["disclaimer"]

    fetched = client.get(f"/api/v1/jobs/{ctx['job_id']}/completion-evidence")
    assert fetched.status_code == 200 and fetched.json() == ev
    assert _status(client, ctx["job_id"]) == "awaiting_confirmation"


def test_evidence_without_before_photos_is_allowed(booked_job, flow):
    ctx = booked_job()
    flow.start(ctx)
    resp = flow.evidence(ctx, before_image_ids=[])
    assert resp.status_code == 201 and resp.json()["before_images"] == []


@pytest.mark.parametrize(
    "overrides",
    [
        {"after_image_ids": []},
        {"after_image_ids": None},
        {"worker_id": None},
        {"note": "x" * 501},
        {"after_image_ids": ["a", "b", "c", "d", "e", "f"]},
        {"unexpected": True},
    ],
)
def test_missing_or_invalid_evidence_fields(client, booked_job, flow, overrides):
    ctx = booked_job()
    flow.start(ctx)
    body = {"worker_id": ctx["worker_id"], "after_image_ids": ["x"], **overrides}
    body = {k: v for k, v in body.items() if v is not None}
    resp = client.post(f"/api/v1/jobs/{ctx['job_id']}/completion-evidence", json=body)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"
    assert _status(client, ctx["job_id"]) == "in_progress"


def test_same_image_twice_rejected(client, booked_job, flow, upload_image):
    ctx = booked_job()
    flow.start(ctx)
    img = upload_image()
    resp = flow.evidence(ctx, before_image_ids=[img], after_image_ids=[img])
    assert resp.status_code == 422


def test_unknown_image_references_rejected(client, booked_job, flow, upload_image):
    ctx = booked_job()
    flow.start(ctx)
    real = upload_image()
    resp = flow.evidence(ctx, before_image_ids=["missing-1"], after_image_ids=[real, "missing-2"])
    assert resp.status_code == 422
    err = resp.json()["error"]
    assert err["code"] == "invalid_reference"
    assert err["details"] == [{"missing_image_ids": ["missing-1", "missing-2"]}]
    assert _status(client, ctx["job_id"]) == "in_progress"
    with client.app.state.session_factory() as s:
        assert s.query(CompletionEvidence).count() == 0


def test_evidence_before_start_or_booking(client, booked_job, make_job, make_worker, flow):
    ctx = booked_job()
    resp = flow.evidence(ctx)  # booked, not started
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "job_not_started"

    job, w = make_job(), make_worker()
    resp = flow.evidence({"job_id": job["id"], "worker_id": w["id"]})
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "job_not_booked"


def test_only_booked_worker_can_submit_evidence(client, booked_job, make_worker, flow):
    ctx = booked_job()
    flow.start(ctx)
    other = make_worker(display_name="Other")
    resp = flow.evidence({**ctx, "worker_id": other["id"]})
    assert resp.status_code == 403 and resp.json()["error"]["code"] == "actor_mismatch"


def test_repeated_evidence_is_rejected_and_original_kept(client, booked_job, flow):
    ctx = booked_job()
    flow.start(ctx)
    first = flow.evidence(ctx, note="first").json()
    resp = flow.evidence(ctx, note="second")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "evidence_already_submitted"
    assert client.get(f"/api/v1/jobs/{ctx['job_id']}/completion-evidence").json() == first


def test_get_evidence_errors(client, booked_job):
    assert client.get("/api/v1/jobs/nope/completion-evidence").status_code == 404
    ctx = booked_job()
    resp = client.get(f"/api/v1/jobs/{ctx['job_id']}/completion-evidence")
    assert resp.status_code == 404 and resp.json()["error"]["code"] == "not_found"


def test_concurrent_status_change_is_detected(client, booked_job):
    """apply_transition refuses to overwrite a status changed by another request."""
    from app.services.lifecycle import InvalidTransitionError, apply_transition

    ctx = booked_job()
    with client.app.state.session_factory() as stale:
        job = stale.get(Job, ctx["job_id"])
        assert job.status == "booked"
        with client.app.state.session_factory() as other:
            other.get(Job, ctx["job_id"]).status = "in_progress"
            other.commit()
        with pytest.raises(InvalidTransitionError, match="concurrently"):
            apply_transition(stale, job, JobStatus.in_progress)
