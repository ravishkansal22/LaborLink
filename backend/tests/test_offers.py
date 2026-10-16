import pytest
from conftest import FAR
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError

from app.models import Offer, PriceEstimateRecord
from app.schemas.pricing import AmountRange, OfferLimits
from app.services.pricing import offer_terms


def _terms(client, job_id):
    return client.get(f"/api/v1/jobs/{job_id}/offers").json()["offer_terms"]


# --- unit: offer terms come from the existing estimate ----------------------------------------

def test_offer_terms_from_estimate(client, make_job):
    from app.services.jobs import estimate_from_record, get_job

    job = make_job()
    card = client.app.state.rate_card
    with client.app.state.session_factory() as s:
        est = estimate_from_record(get_job(s, job["id"]).current_estimate)
    assert est.labour == AmountRange(min=300, max=450)
    terms = offer_terms(card, est)
    assert (terms.permitted_min, terms.suggested_labour_amount, terms.permitted_max) == (
        300, 380, 560  # 450 x 1.25 = 562.5 -> 560; midpoint 375 -> 380 (half up)
    )
    assert terms.price_estimate_id == job["price_estimate"]["id"]
    assert "not a legal requirement" in terms.basis

    looser = card.model_copy(update={"offer_limits": OfferLimits(floor_ratio=0.9,
                                                                 ceiling_ratio=1.1)})
    t2 = offer_terms(looser, est)
    assert (t2.permitted_min, t2.permitted_max) == (270, 490)


def test_offer_limits_validation():
    with pytest.raises(ValueError):
        OfferLimits(floor_ratio=1.2)
    with pytest.raises(ValueError):
        OfferLimits(ceiling_ratio=0.8)


# --- API ---------------------------------------------------------------------------------------

def test_accept_suggested_offer(client, make_worker, make_job, make_offer):
    job, w = make_job(), make_worker()
    resp = make_offer(job["id"], w["id"], message="  Available today  ")
    assert resp.status_code == 201
    offer = resp.json()
    terms = _terms(client, job["id"])
    assert offer["kind"] == "accept_suggested"
    assert offer["labour_amount"] == terms["suggested_labour_amount"]
    assert offer["total_amount"] == offer["labour_amount"] + offer["travel_allowance"]
    assert offer["status"] == "pending" and offer["message"] == "Available today"
    assert offer["price_estimate_id"] == job["price_estimate"]["id"]


@pytest.mark.parametrize("which", ["permitted_min", "permitted_max"])
def test_counter_offer_at_range_bounds(client, make_worker, make_job, make_offer, which):
    job, w = make_job(), make_worker()
    amount = _terms(client, job["id"])[which]
    resp = make_offer(job["id"], w["id"], kind="counter", labour_amount=amount)
    assert resp.status_code == 201
    assert resp.json()["labour_amount"] == amount


@pytest.mark.parametrize("delta, side", [(-10, "permitted_min"), (10, "permitted_max")])
def test_counter_offer_outside_range_rejected(client, make_worker, make_job, make_offer,
                                              delta, side):
    job, w = make_job(), make_worker()
    terms = _terms(client, job["id"])
    resp = make_offer(job["id"], w["id"], kind="counter", labour_amount=terms[side] + delta)
    assert resp.status_code == 422
    err = resp.json()["error"]
    assert err["code"] == "offer_out_of_range"
    assert err["details"][0]["permitted_min"] == terms["permitted_min"]
    with client.app.state.session_factory() as s:
        assert s.query(Offer).count() == 0


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "counter"},
        {"kind": "accept_suggested", "labour_amount": 400},
        {"kind": "counter", "labour_amount": 0},
        {"kind": "counter", "labour_amount": -50},
        {"kind": "haggle"},
        {"kind": "counter", "labour_amount": 400, "message": "x" * 281},
    ],
)
def test_invalid_offer_payload(client, make_worker, make_job, make_offer, body):
    job, w = make_job(), make_worker()
    resp = make_offer(job["id"], w["id"], **body)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_offer_for_unknown_job_or_worker(client, make_worker, make_job, make_offer):
    job, w = make_job(), make_worker()
    assert make_offer("nope", w["id"]).status_code == 404
    resp = make_offer(job["id"], "nope")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_reference"


def test_duplicate_active_offer_rejected(client, make_worker, make_job, make_offer):
    job, w = make_job(), make_worker()
    first = make_offer(job["id"], w["id"]).json()
    resp = make_offer(job["id"], w["id"], kind="counter",
                      labour_amount=_terms(client, job["id"])["permitted_min"])
    assert resp.status_code == 409
    err = resp.json()["error"]
    assert err["code"] == "duplicate_offer" and err["details"] == [{"offer_id": first["id"]}]


def test_database_enforces_one_pending_offer_per_worker_and_job(client, make_worker, make_job,
                                                               make_offer):
    job, w = make_job(), make_worker()
    first = make_offer(job["id"], w["id"]).json()
    with client.app.state.session_factory() as s:
        s.add(Offer(job_id=job["id"], worker_id=w["id"], price_estimate_id=first[
            "price_estimate_id"], kind="counter", labour_amount=400, travel_allowance=50,
            currency="INR", status="pending"))
        with pytest.raises(IntegrityError):
            s.commit()
        s.rollback()
        # A closed offer does not block a new pending one (partial index).
        s.add(Offer(job_id=job["id"], worker_id=w["id"], price_estimate_id=first[
            "price_estimate_id"], kind="counter", labour_amount=400, travel_allowance=50,
            currency="INR", status="rejected"))
        s.commit()


@pytest.mark.parametrize(
    "worker_kw, issue",
    [
        ({"trades": ["electrician"]}, "trade_mismatch"),
        ({"availability": "unavailable"}, "unavailable"),
        ({"location": FAR, "service_radius_km": 5}, "outside_service_radius"),
    ],
)
def test_ineligible_worker_rejected(client, make_worker, make_job, make_offer, worker_kw, issue):
    job, w = make_job(), make_worker(**worker_kw)
    resp = make_offer(job["id"], w["id"])
    assert resp.status_code == 409
    err = resp.json()["error"]
    assert err["code"] == "worker_not_eligible"
    assert err["details"][0]["issue"] == issue


def test_offer_on_job_without_trade(client, make_worker, make_job, make_offer):
    job = make_job(description="need help asap", location={"address": "Surat"})
    resp = make_offer(job["id"], make_worker()["id"])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "trade_required"


def test_offer_rejected_when_estimate_missing_or_invalid(client, make_worker, make_job,
                                                         make_offer):
    w = make_worker()
    job = make_job()
    with client.app.state.session_factory() as s:
        s.execute(delete(PriceEstimateRecord).where(PriceEstimateRecord.job_id == job["id"]))
        s.commit()
    resp = make_offer(job["id"], w["id"])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "estimate_unavailable"

    job2 = make_job()
    with client.app.state.session_factory() as s:
        rec = s.query(PriceEstimateRecord).filter_by(job_id=job2["id"]).one()
        rec.payload = {"min_amount": "corrupt"}
        s.commit()
    resp = make_offer(job2["id"], w["id"])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "estimate_unavailable"


def test_job_offers_listing_supports_comparison(client, make_worker, make_job, make_offer):
    job = make_job()
    a = make_worker(display_name="Asha", years_experience=9)
    b = make_worker(display_name="Bala", years_experience=1)
    terms = _terms(client, job["id"])
    make_offer(job["id"], a["id"])
    make_offer(job["id"], b["id"], kind="counter", labour_amount=terms["permitted_min"])

    body = client.get(f"/api/v1/jobs/{job['id']}/offers").json()
    assert body["job_status"] == "estimated"
    assert [o["worker"]["display_name"] for o in body["offers"]] == ["Asha", "Bala"]  # oldest
    asha, bala = body["offers"]
    assert asha["difference_from_suggested"] == 0
    assert bala["difference_from_suggested"] == terms["permitted_min"] - terms[
        "suggested_labour_amount"]
    assert asha["match_score"] > bala["match_score"]
    assert asha["currently_eligible"] and asha["distance_km"] is not None
    assert "not ranked by price" in body["ordering"]


def test_job_offers_for_unknown_job(client):
    assert client.get("/api/v1/jobs/nope/offers").status_code == 404


def test_worker_offers_listing(client, make_worker, make_job, make_offer):
    w = make_worker()
    j1, j2 = make_job(), make_job(description="Bathroom drain is blocked")
    o1 = make_offer(j1["id"], w["id"]).json()
    o2 = make_offer(j2["id"], w["id"]).json()
    body = client.get(f"/api/v1/workers/{w['id']}/offers").json()
    assert [o["id"] for o in body["offers"]] == [o2["id"], o1["id"]]  # newest first
    assert body["offers"][0]["job_status"] == "estimated"
    assert body["offers"][0]["problem_summary"]
    assert client.get("/api/v1/workers/nope/offers").status_code == 404
