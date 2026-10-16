"""Phase 3: employer confirmation or dispute of completed work."""

import pytest
from conftest import EMPLOYER
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.models import CompletionReview, Job, Settlement


def _counts(client, job_id):
    with client.app.state.session_factory() as s:
        return (
            s.get(Job, job_id).status,
            s.query(CompletionReview).filter_by(job_id=job_id).count(),
            s.query(Settlement).filter_by(job_id=job_id).count(),
        )


def test_successful_confirmation_creates_pending_simulated_settlement(client, booked_job, flow):
    ctx = flow.to_awaiting(booked_job())
    resp = flow.review(ctx)
    assert resp.status_code == 201
    body = resp.json()
    booking = ctx["booking"]
    assert body["decision"] == "confirmed" and body["job_status"] == "completed"
    assert body["employer_id"] == EMPLOYER
    assert body["agreed_amount"] == {
        "labour_amount": booking["agreed_labour_amount"],
        "travel_allowance": booking["travel_allowance"],
        "total_amount": booking["agreed_total_amount"],
        "currency": booking["currency"],
    }
    s = body["settlement"]
    assert s["status"] == "simulated_pending" and s["mode"] == "simulated"
    assert s["amount"] == booking["agreed_total_amount"] and s["settled_at"] is None
    assert "No money has been moved" in s["disclaimer"]
    assert _counts(client, ctx["job_id"]) == ("completed", 1, 1)


@pytest.mark.parametrize("stage", ["booked", "in_progress"])
def test_confirmation_without_evidence(client, booked_job, flow, stage):
    ctx = booked_job()
    if stage == "in_progress":
        flow.start(ctx)
    resp = flow.review(ctx)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "completion_evidence_missing"
    assert _counts(client, ctx["job_id"]) == (stage, 0, 0)


def test_confirmation_by_different_employer(client, booked_job, flow):
    ctx = flow.to_awaiting(booked_job())
    for decision in ("confirm", "dispute"):
        resp = flow.review(ctx, decision=decision, employer_id="employer-someone-else",
                           **({"dispute_reason": "Not done"} if decision == "dispute" else {}))
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "actor_mismatch"
    assert _counts(client, ctx["job_id"]) == ("awaiting_confirmation", 0, 0)


def test_job_without_recorded_employer(client, booked_job, flow):
    ctx = flow.to_awaiting(booked_job(employer_id=None))
    resp = flow.review(ctx, employer_id="anyone")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "employer_not_recorded"


def test_employer_can_be_recorded_at_booking(client, make_job, make_worker, make_offer, flow):
    job, w = make_job(), make_worker()
    assert job["employer_id"] is None
    offer = make_offer(job["id"], w["id"]).json()
    resp = client.post(f"/api/v1/jobs/{job['id']}/bookings",
                       json={"offer_id": offer["id"], "employer_id": "employer-ravi"})
    assert resp.status_code == 201
    assert client.get(f"/api/v1/jobs/{job['id']}").json()["employer_id"] == "employer-ravi"
    ctx = flow.to_awaiting({"job_id": job["id"], "worker_id": w["id"],
                            "employer_id": "employer-ravi"})
    assert flow.review(ctx).status_code == 201


def test_booking_with_conflicting_employer_rejected(client, make_job, make_worker, make_offer):
    job = make_job(employer_id=EMPLOYER)
    offer = make_offer(job["id"], make_worker()["id"]).json()
    resp = client.post(f"/api/v1/jobs/{job['id']}/bookings",
                       json={"offer_id": offer["id"], "employer_id": "employer-other"})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "actor_mismatch"
    assert client.get(f"/api/v1/jobs/{job['id']}").json()["status"] == "estimated"


@pytest.mark.parametrize("bad", ["", "has space", "x" * 65, "semi;colon"])
def test_employer_id_format_validated(client, bad):
    resp = client.post("/api/v1/jobs", json={
        "description": "Kitchen tap leaking", "location": {"address": "x"}, "employer_id": bad,
    })
    assert resp.status_code == 422


def test_dispute(client, booked_job, flow):
    ctx = flow.to_awaiting(booked_job())
    resp = flow.dispute(ctx, reason="  Tap still leaks after the repair  ")
    assert resp.status_code == 201
    body = resp.json()
    assert body["decision"] == "disputed" and body["job_status"] == "disputed"
    assert body["dispute_reason"] == "Tap still leaks after the repair"
    assert body["settlement"] is None
    assert "will not be settled" in body["note"]
    assert _counts(client, ctx["job_id"]) == ("disputed", 1, 0)


@pytest.mark.parametrize(
    "body",
    [
        {"decision": "dispute"},
        {"decision": "dispute", "dispute_reason": "bad"},
        {"decision": "confirm", "dispute_reason": "Looks fine"},
        {"decision": "approve"},
        {"decision": "confirm", "amount": 1},
    ],
)
def test_invalid_review_payloads(client, booked_job, flow, body):
    ctx = flow.to_awaiting(booked_job())
    resp = client.post(f"/api/v1/jobs/{ctx['job_id']}/completion-confirmation",
                       json={"employer_id": EMPLOYER, **body})
    assert resp.status_code == 422
    assert _counts(client, ctx["job_id"]) == ("awaiting_confirmation", 0, 0)


@pytest.mark.parametrize("first, second", [("confirm", "confirm"), ("dispute", "confirm"),
                                           ("confirm", "dispute")])
def test_repeated_review_creates_no_duplicates(client, booked_job, flow, first, second):
    ctx = flow.to_awaiting(booked_job())

    def review(decision):
        return flow.review(ctx) if decision == "confirm" else flow.dispute(ctx)

    first_body = review(first).json()
    resp = review(second)
    assert resp.status_code == 409
    err = resp.json()["error"]
    assert err["code"] == "completion_already_reviewed"
    assert err["details"][0]["review_id"] == first_body["id"]
    expected_status = "completed" if first == "confirm" else "disputed"
    assert _counts(client, ctx["job_id"]) == (expected_status, 1, 1 if first == "confirm" else 0)


def test_database_allows_one_review_per_job(client, booked_job, flow):
    ctx = flow.to_completed(booked_job())
    with client.app.state.session_factory() as s:
        existing = s.query(CompletionReview).filter_by(job_id=ctx["job_id"]).one()
        s.add(CompletionReview(job_id=ctx["job_id"], booking_id=existing.booking_id,
                               evidence_id=existing.evidence_id, employer_ref=EMPLOYER,
                               decision="disputed", dispute_reason="again",
                               agreed_labour_amount=1, travel_allowance=0, currency="INR"))
        with pytest.raises(IntegrityError):
            s.commit()


def test_failed_commit_leaves_no_review_or_settlement(client, booked_job, flow, monkeypatch):
    ctx = flow.to_awaiting(booked_job())

    def broken_commit(self):
        raise OperationalError("COMMIT", {}, Exception("disk I/O error"))

    monkeypatch.setattr(Session, "commit", broken_commit)
    resp = flow.review(ctx)
    monkeypatch.undo()
    assert resp.status_code == 503
    assert _counts(client, ctx["job_id"]) == ("awaiting_confirmation", 0, 0)
    assert flow.review(ctx).status_code == 201  # can still be confirmed afterwards


def test_review_unknown_or_unbooked_job(client, make_job, flow):
    resp = flow.review({"job_id": "nope", "employer_id": EMPLOYER})
    assert resp.status_code == 404
    job = make_job(employer_id=EMPLOYER)
    resp = flow.review({"job_id": job["id"], "employer_id": EMPLOYER})
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "job_not_booked"
