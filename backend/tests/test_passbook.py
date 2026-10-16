"""Phase 3: Kamai Passbook, computed from persisted records."""

import pytest


@pytest.fixture
def scenario(client, booked_job, make_worker, flow):
    """Worker A: settled, confirmed-unsettled, disputed, in-progress jobs. Worker B: one settled."""
    a = make_worker(display_name="Asha")
    b = make_worker(display_name="Bala")
    settled = flow.to_settled(booked_job(worker=a))
    pending = flow.to_completed(booked_job(worker=a, description="Bathroom drain is blocked"))
    disputed = flow.to_awaiting(booked_job(worker=a, urgency="urgent"))
    assert flow.dispute(disputed).status_code == 201
    active = booked_job(worker=a, description="Need new concealed pipeline for bathroom fitting")
    flow.start(active)
    other = flow.to_settled(booked_job(worker=b))
    return {"a": a, "b": b, "settled": settled, "pending": pending, "disputed": disputed,
            "active": active, "other": other}


def _total(ctx):
    return ctx["booking"]["agreed_total_amount"]


def _passbook(client, worker_id, **params):
    resp = client.get(f"/api/v1/workers/{worker_id}/passbook", params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_passbook_summary(client, scenario):
    pb = _passbook(client, scenario["a"]["id"])
    s = pb["summary"]
    assert s["completed_jobs"] == 2
    assert s["confirmed_earnings"] == _total(scenario["settled"]) + _total(scenario["pending"])
    assert s["simulated_settled_earnings"] == _total(scenario["settled"])
    assert s["pending_settlements"] == {"count": 1, "amount": _total(scenario["pending"])}
    assert s["disputed"] == {"count": 1, "amount": _total(scenario["disputed"])}
    assert s["active_jobs"] == 1
    assert pb["currency"] == "INR" and pb["total_entries"] == 4
    assert "not a bank statement, a credit score" in pb["disclaimer"]


def test_passbook_entries(client, scenario):
    entries = {e["job_id"]: e for e in _passbook(client, scenario["a"]["id"])["entries"]}
    settled = entries[scenario["settled"]["job_id"]]
    assert settled["earning_status"] == "settled"
    assert settled["settlement_status"] == "simulated_settled"
    assert settled["completed_at"] and settled["settled_at"]
    assert settled["agreed_total_amount"] == _total(scenario["settled"])

    pending = entries[scenario["pending"]["job_id"]]
    assert pending["earning_status"] == "confirmed_unsettled"
    assert pending["settlement_status"] == "simulated_pending" and pending["settled_at"] is None

    disputed = entries[scenario["disputed"]["job_id"]]
    assert disputed["earning_status"] == "disputed"
    assert disputed["settlement_status"] == "withheld_disputed"
    assert disputed["completed_at"] is None and disputed["disputed_at"]
    assert disputed["dispute_reason"]

    active = entries[scenario["active"]["job_id"]]
    assert active["earning_status"] == "in_progress" and active["job_status"] == "in_progress"
    assert active["settlement_status"] == "none"


def test_workers_do_not_see_each_others_records(client, scenario):
    a_jobs = {e["job_id"] for e in _passbook(client, scenario["a"]["id"])["entries"]}
    b = _passbook(client, scenario["b"]["id"])
    assert {e["job_id"] for e in b["entries"]} == {scenario["other"]["job_id"]}
    assert not a_jobs & {e["job_id"] for e in b["entries"]}
    assert b["summary"]["simulated_settled_earnings"] == _total(scenario["other"])
    assert b["summary"]["disputed"]["count"] == 0


def test_repeated_calls_do_not_double_count(client, scenario, flow):
    first = _passbook(client, scenario["a"]["id"])
    assert _passbook(client, scenario["a"]["id"]) == first
    flow.settle(scenario["settled"])  # rejected duplicate settlement
    assert _passbook(client, scenario["a"]["id"]) == first


def test_settling_pending_moves_amount_between_totals(client, scenario, flow):
    before = _passbook(client, scenario["a"]["id"])["summary"]
    assert flow.settle(scenario["pending"]).status_code == 200
    after = _passbook(client, scenario["a"]["id"])["summary"]
    amount = _total(scenario["pending"])
    assert after["confirmed_earnings"] == before["confirmed_earnings"]
    assert after["simulated_settled_earnings"] == before["simulated_settled_earnings"] + amount
    assert after["pending_settlements"] == {"count": 0, "amount": 0}


def test_limit_applies_to_entries_not_totals(client, scenario):
    pb = _passbook(client, scenario["a"]["id"], limit=1)
    assert len(pb["entries"]) == 1 and pb["total_entries"] == 4 and pb["limit"] == 1
    assert pb["summary"] == _passbook(client, scenario["a"]["id"])["summary"]
    assert client.get(f"/api/v1/workers/{scenario['a']['id']}/passbook?limit=0").status_code == 422


def test_empty_and_unknown_passbook(client, make_worker):
    w = make_worker()
    pb = _passbook(client, w["id"])
    assert pb["entries"] == [] and pb["total_entries"] == 0
    assert pb["summary"]["confirmed_earnings"] == 0 and pb["currency"] == "INR"
    assert client.get("/api/v1/workers/nope/passbook").status_code == 404
