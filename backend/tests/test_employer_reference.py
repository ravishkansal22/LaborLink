"""Regression tests for employer-reference handling (jobs.employer_ref).

Rules under test: a booking records an employer only when none is recorded; a recorded employer is
never replaced; only the recorded employer can confirm, dispute or settle; a job booked without an
employer (e.g. before Phase 3) is rejected clearly and can never be "claimed" through the API.
"""

import pytest
from conftest import EMPLOYER
from sqlalchemy import inspect, text

from app.db import create_db_engine, init_db
from app.models import CompletionReview, Job, Settlement
from app.schemas.marketplace import BookingCreate
from app.services.bookings import JobAlreadyBookedError, confirm_booking


def _employer_ref(client, job_id):
    with client.app.state.session_factory() as s:
        return s.get(Job, job_id).employer_ref


def _book(client, job_id, offer_id, **extra):
    return client.post(f"/api/v1/jobs/{job_id}/bookings", json={"offer_id": offer_id, **extra})


# --- establishing the reference at booking -----------------------------------------------------

def test_new_booking_establishes_employer_reference(client, make_job, make_worker, make_offer):
    job = make_job()
    assert _employer_ref(client, job["id"]) is None
    offer = make_offer(job["id"], make_worker()["id"]).json()
    assert _book(client, job["id"], offer["id"], employer_id="employer-ravi").status_code == 201
    assert _employer_ref(client, job["id"]) == "employer-ravi"
    assert client.get(f"/api/v1/jobs/{job['id']}").json()["employer_id"] == "employer-ravi"


@pytest.mark.parametrize("booking_employer", [None, EMPLOYER])
def test_reference_from_job_creation_is_kept(client, make_job, make_worker, make_offer,
                                             booking_employer):
    job = make_job(employer_id=EMPLOYER)
    offer = make_offer(job["id"], make_worker()["id"]).json()
    extra = {"employer_id": booking_employer} if booking_employer else {}
    assert _book(client, job["id"], offer["id"], **extra).status_code == 201
    assert _employer_ref(client, job["id"]) == EMPLOYER


def test_existing_reference_cannot_be_replaced(client, make_job, make_worker, make_offer):
    job = make_job(employer_id=EMPLOYER)
    offer = make_offer(job["id"], make_worker()["id"]).json()
    resp = _book(client, job["id"], offer["id"], employer_id="employer-intruder")
    assert resp.status_code == 403 and resp.json()["error"]["code"] == "actor_mismatch"
    assert _employer_ref(client, job["id"]) == EMPLOYER
    after = client.get(f"/api/v1/jobs/{job['id']}/offers").json()
    assert after["job_status"] == "estimated"  # nothing was booked
    assert after["offers"][0]["status"] == "pending"


def test_losing_concurrent_booking_cannot_overwrite_reference(client, make_job, make_worker,
                                                              make_offer):
    """Two bookings race on a job with no employer: the loser's employer_id is never stored."""
    job = make_job()
    o1 = make_offer(job["id"], make_worker(display_name="Asha")["id"]).json()
    o2 = make_offer(job["id"], make_worker(display_name="Bala")["id"]).json()
    factory, card = client.app.state.session_factory, client.app.state.rate_card
    with factory() as stale:
        assert stale.get(Job, job["id"]).employer_ref is None  # read before the winner commits
        assert _book(client, job["id"], o1["id"], employer_id="employer-first").status_code == 201
        with pytest.raises(JobAlreadyBookedError):
            confirm_booking(stale, job["id"],
                            BookingCreate(offer_id=o2["id"], employer_id="employer-second"),
                            card=card)
    assert _employer_ref(client, job["id"]) == "employer-first"


# --- only the associated employer may decide ---------------------------------------------------

@pytest.mark.parametrize("decision", ["confirm", "dispute"])
def test_employer_recorded_at_booking_can_decide(client, make_job, make_worker, make_offer, flow,
                                                 decision):
    job, worker = make_job(), make_worker()
    offer = make_offer(job["id"], worker["id"]).json()
    _book(client, job["id"], offer["id"], employer_id="employer-ravi")
    ctx = flow.to_awaiting({"job_id": job["id"], "worker_id": worker["id"],
                            "employer_id": "employer-ravi"})

    for other in ("employer-intruder", EMPLOYER):
        resp = (flow.review(ctx, employer_id=other) if decision == "confirm"
                else flow.review(ctx, decision="dispute", employer_id=other,
                                 dispute_reason="Not satisfied"))
        assert resp.status_code == 403 and resp.json()["error"]["code"] == "actor_mismatch"

    resp = flow.review(ctx) if decision == "confirm" else flow.dispute(ctx)
    assert resp.status_code == 201
    assert resp.json()["employer_id"] == "employer-ravi"
    assert resp.json()["job_status"] == ("completed" if decision == "confirm" else "disputed")


# --- historical bookings without an employer ---------------------------------------------------

def _book_without_employer_then_simulate_phase2_db(make_client, make_job, make_worker, make_offer,
                                                   settings):
    """Book a job with no employer, then strip the Phase 3 column as a Phase 2 database had it."""
    old = make_client()
    job = make_job(old)
    worker = make_worker(old)
    offer = make_offer(job["id"], worker["id"], c=old).json()
    assert _book(old, job["id"], offer["id"]).status_code == 201

    engine = create_db_engine(settings)
    with engine.begin() as conn:
        conn.execute(text("DROP INDEX ix_jobs_employer_ref"))
        conn.execute(text("ALTER TABLE jobs DROP COLUMN employer_ref"))
    assert "employer_ref" not in {c["name"] for c in inspect(engine).get_columns("jobs")}
    engine.dispose()
    return job, worker


def test_historical_booking_without_employer_is_rejected_safely(
    settings, make_client, make_job, make_worker, make_offer, flow, upload_image
):
    job, worker = _book_without_employer_then_simulate_phase2_db(
        make_client, make_job, make_worker, make_offer, settings
    )
    client = make_client()  # startup upgrade re-adds jobs.employer_ref as NULL
    before = client.get(f"/api/v1/jobs/{job['id']}").json()
    assert before["status"] == "booked" and before["employer_id"] is None
    assert before["work_order"] == job["work_order"]  # existing data preserved

    # The worker side still works (it does not depend on the employer)...
    flow.client, flow.upload = client, lambda: upload_image(client)
    ctx = flow.to_awaiting({"job_id": job["id"], "worker_id": worker["id"],
                            "employer_id": EMPLOYER})

    # ...but nothing that needs an employer identity is allowed, for any employer_id.
    for resp in (flow.review(ctx), flow.dispute(ctx), flow.settle(ctx)):
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "employer_not_recorded"

    # Knowing the job id is not enough to claim it through the booking endpoint.
    booking_offer = client.get(f"/api/v1/jobs/{job['id']}/offers").json()["offers"][0]
    resp = _book(client, job["id"], booking_offer["id"], employer_id="employer-claimant")
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "job_already_booked"

    assert _employer_ref(client, job["id"]) is None
    assert client.get(f"/api/v1/jobs/{job['id']}").json()["status"] == "awaiting_confirmation"
    with client.app.state.session_factory() as s:
        assert s.query(CompletionReview).count() == 0
        assert s.query(Settlement).count() == 0
    passbook = client.get(f"/api/v1/workers/{worker['id']}/passbook").json()
    assert passbook["entries"][0]["earning_status"] == "in_progress"
    assert passbook["summary"]["confirmed_earnings"] == 0


def test_documented_manual_backfill_enables_the_verified_employer(
    settings, make_client, make_job, make_worker, make_offer, flow, upload_image
):
    """The operator SQL in docs/BACKEND_ARCHITECTURE.md fills only an empty reference."""
    job, worker = _book_without_employer_then_simulate_phase2_db(
        make_client, make_job, make_worker, make_offer, settings
    )
    engine = create_db_engine(settings)
    init_db(engine)
    backfill = text("UPDATE jobs SET employer_ref = :employer "
                    "WHERE id = :job AND employer_ref IS NULL")
    with engine.begin() as conn:
        assert conn.execute(backfill, {"employer": EMPLOYER, "job": job["id"]}).rowcount == 1
        # Running it again (or with another employer) changes nothing.
        assert conn.execute(backfill, {"employer": "employer-other",
                                       "job": job["id"]}).rowcount == 0
    engine.dispose()

    client = make_client()
    flow.client, flow.upload = client, lambda: upload_image(client)
    ctx = flow.to_awaiting({"job_id": job["id"], "worker_id": worker["id"],
                            "employer_id": EMPLOYER})
    assert flow.review(ctx, employer_id="employer-other").status_code == 403
    assert flow.review(ctx).status_code == 201
    assert flow.settle(ctx).json()["status"] == "simulated_settled"
