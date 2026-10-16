"""Phase 3: simulated settlement."""

import threading

import pytest
from conftest import EMPLOYER
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Settlement
from app.schemas.completion import SettlementRequest
from app.services.settlements import settle


def _settlements(client, job_id):
    with client.app.state.session_factory() as s:
        return [(x.status, x.amount, x.settled_at is not None)
                for x in s.query(Settlement).filter_by(job_id=job_id)]


def test_settlement_after_confirmation(client, booked_job, flow):
    ctx = flow.to_completed(booked_job())
    booking = ctx["booking"]
    pending = client.get(f"/api/v1/jobs/{ctx['job_id']}/settlement").json()
    assert pending["status"] == "simulated_pending"

    resp = flow.settle(ctx)
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == pending["id"]
    assert body["status"] == "simulated_settled" and body["mode"] == "simulated"
    assert body["amount"] == booking["agreed_total_amount"]
    assert body["labour_amount"] == booking["agreed_labour_amount"]
    assert body["travel_allowance"] == booking["travel_allowance"]
    assert body["worker_id"] == ctx["worker_id"] and body["employer_id"] == EMPLOYER
    assert body["booking_id"] == booking["id"] and body["settled_at"] is not None
    assert client.get(f"/api/v1/jobs/{ctx['job_id']}/settlement").json() == body
    assert _settlements(client, ctx["job_id"]) == [("simulated_settled", body["amount"], True)]


@pytest.mark.parametrize("stage", ["booked", "in_progress", "awaiting_confirmation"])
def test_settlement_before_confirmation_rejected(client, booked_job, flow, stage):
    ctx = booked_job()
    if stage != "booked":
        flow.start(ctx)
    if stage == "awaiting_confirmation":
        flow.evidence(ctx)
    resp = flow.settle(ctx)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "completion_not_confirmed"
    assert _settlements(client, ctx["job_id"]) == []
    resp = client.get(f"/api/v1/jobs/{ctx['job_id']}/settlement")
    assert resp.status_code == 404


def test_disputed_job_cannot_be_settled(client, booked_job, flow):
    ctx = flow.to_awaiting(booked_job())
    flow.dispute(ctx)
    resp = flow.settle(ctx)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "job_disputed"
    get = client.get(f"/api/v1/jobs/{ctx['job_id']}/settlement")
    assert get.status_code == 404 and "disputed" in get.json()["error"]["message"]
    assert _settlements(client, ctx["job_id"]) == []


def test_duplicate_settlement_prevented(client, booked_job, flow):
    ctx = flow.to_settled(booked_job())
    first = client.get(f"/api/v1/jobs/{ctx['job_id']}/settlement").json()
    for _ in range(3):
        resp = flow.settle(ctx)
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "already_settled"
    assert client.get(f"/api/v1/jobs/{ctx['job_id']}/settlement").json() == first
    assert len(_settlements(client, ctx["job_id"])) == 1


def test_database_rejects_second_settlement_for_booking(client, booked_job, flow):
    ctx = flow.to_completed(booked_job())
    with client.app.state.session_factory() as s:
        existing = s.query(Settlement).filter_by(job_id=ctx["job_id"]).one()
        s.add(Settlement(job_id=existing.job_id, booking_id=existing.booking_id,
                         review_id=existing.review_id, worker_id=existing.worker_id,
                         employer_ref=EMPLOYER, labour_amount=1, travel_allowance=0, amount=1,
                         currency="INR", status="simulated_pending"))
        with pytest.raises(IntegrityError):
            s.commit()


def test_database_rejects_unknown_settlement_status(client, booked_job, flow):
    ctx = flow.to_completed(booked_job())
    with client.app.state.session_factory() as s:
        s.query(Settlement).filter_by(job_id=ctx["job_id"]).one().status = "paid"
        with pytest.raises(IntegrityError):
            s.commit()


def test_client_cannot_supply_amount(client, booked_job, flow):
    ctx = flow.to_completed(booked_job())
    resp = flow.settle(ctx, amount=99999)
    assert resp.status_code == 422
    assert resp.json()["error"]["details"][0]["loc"] == ["body", "amount"]
    assert _settlements(client, ctx["job_id"])[0][0] == "simulated_pending"


def test_amount_comes_from_booking_not_current_rates(client, booked_job, flow):
    ctx = booked_job()
    # Rates rise after booking; the settlement must still use the booked amount.
    card = client.app.state.rate_card
    trades = dict(card.trades)
    trades["plumber"] = card.trades["plumber"].model_copy(update={"hourly_rate": 900})
    client.app.state.rate_card = card.model_copy(update={"trades": trades})
    flow.to_completed(ctx)
    body = flow.settle(ctx).json()
    assert body["amount"] == ctx["booking"]["agreed_total_amount"]


def test_only_job_employer_can_settle(client, booked_job, flow):
    ctx = flow.to_completed(booked_job())
    resp = flow.settle(ctx, employer_id="employer-other")
    assert resp.status_code == 403 and resp.json()["error"]["code"] == "actor_mismatch"
    assert _settlements(client, ctx["job_id"])[0][0] == "simulated_pending"


def test_settlement_unknown_job(client, flow):
    assert flow.settle({"job_id": "nope", "employer_id": EMPLOYER}).status_code == 404
    assert client.get("/api/v1/jobs/nope/settlement").status_code == 404


def test_failed_commit_leaves_settlement_pending(client, booked_job, flow, monkeypatch):
    ctx = flow.to_completed(booked_job())

    def broken_commit(self):
        raise OperationalError("COMMIT", {}, Exception("disk I/O error"))

    monkeypatch.setattr(Session, "commit", broken_commit)
    resp = flow.settle(ctx)
    monkeypatch.undo()
    assert resp.status_code == 503
    assert _settlements(client, ctx["job_id"]) == [
        ("simulated_pending", ctx["booking"]["agreed_total_amount"], False)
    ]
    assert flow.settle(ctx).status_code == 200


def test_concurrent_settlements_settle_once(client, booked_job, flow):
    ctx = flow.to_completed(booked_job())
    factory = client.app.state.session_factory
    barrier = threading.Barrier(2)
    results = []

    def attempt():
        with factory() as session:
            barrier.wait()
            try:
                settle(session, ctx["job_id"], SettlementRequest(employer_id=EMPLOYER))
                results.append("ok")
            except AppError as exc:
                results.append(exc.code)

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    assert sorted(results) == ["already_settled", "ok"]
    assert len(_settlements(client, ctx["job_id"])) == 1
