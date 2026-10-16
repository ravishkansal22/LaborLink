import threading

import pytest
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Booking, Job, Offer
from app.schemas.marketplace import BookingCreate
from app.services.bookings import JobAlreadyBookedError, confirm_booking


@pytest.fixture
def two_offers(client, make_worker, make_job, make_offer):
    job = make_job()
    a = make_worker(display_name="Asha", years_experience=9)
    b = make_worker(display_name="Bala", years_experience=2)
    oa = make_offer(job["id"], a["id"]).json()
    ob = make_offer(job["id"], b["id"]).json()
    return job, oa, ob


def _book(client, job_id, offer_id):
    return client.post(f"/api/v1/jobs/{job_id}/bookings", json={"offer_id": offer_id})


def _state(client, job_id):
    with client.app.state.session_factory() as s:
        job = s.get(Job, job_id)
        rows = s.query(Offer).filter_by(job_id=job_id)
        offers = {o.id: (o.status, o.closed_reason) for o in rows}
        bookings = s.query(Booking).filter_by(job_id=job_id).count()
        return job.status, offers, bookings


def test_valid_booking_confirmation(client, two_offers):
    job, oa, ob = two_offers
    assert client.get(f"/api/v1/jobs/{job['id']}/booking").status_code == 404

    resp = _book(client, job["id"], oa["id"])
    assert resp.status_code == 201
    booking = resp.json()
    assert booking["status"] == "confirmed"
    assert booking["offer_id"] == oa["id"] and booking["worker"]["display_name"] == "Asha"
    assert booking["agreed_labour_amount"] == oa["labour_amount"]
    assert booking["agreed_total_amount"] == oa["total_amount"]
    assert booking["payment"] == "not_handled"

    status, offers, n = _state(client, job["id"])
    assert status == "booked" and n == 1
    assert offers[oa["id"]] == ("accepted", None)
    assert offers[ob["id"]] == ("rejected", "another_offer_booked")

    assert client.get(f"/api/v1/jobs/{job['id']}/booking").json() == booking
    assert client.get(f"/api/v1/jobs/{job['id']}").json()["status"] == "booked"


def test_second_booking_rejected(client, two_offers):
    job, oa, ob = two_offers
    assert _book(client, job["id"], oa["id"]).status_code == 201
    for offer in (ob, oa):
        resp = _book(client, job["id"], offer["id"])
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "job_already_booked"
    assert _state(client, job["id"])[2] == 1


def test_booked_job_is_closed_to_new_offers_and_recalculation(client, two_offers, make_worker,
                                                              make_offer):
    job, oa, _ = two_offers
    _book(client, job["id"], oa["id"])
    resp = make_offer(job["id"], make_worker()["id"])
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "job_not_open"
    resp = client.post(f"/api/v1/jobs/{job['id']}/price-estimate")
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "job_not_open"
    resp = client.get(f"/api/v1/jobs/{job['id']}/matches")
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "job_not_open"


def test_booking_reference_errors(client, two_offers, make_job, make_worker, make_offer):
    job, oa, _ = two_offers
    assert _book(client, "nope", oa["id"]).status_code == 404

    resp = _book(client, job["id"], "nope")
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "invalid_reference"

    other = make_job(description="Bathroom drain is blocked")
    other_offer = make_offer(other["id"], make_worker()["id"]).json()
    resp = _book(client, job["id"], other_offer["id"])
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "offer_job_mismatch"

    resp = client.post(f"/api/v1/jobs/{job['id']}/bookings", json={})
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "validation_error"
    assert _state(client, job["id"])[0] == "estimated"


def test_offer_must_still_be_pending(client, two_offers):
    job, oa, _ = two_offers
    with client.app.state.session_factory() as s:
        s.get(Offer, oa["id"]).status = "rejected"
        s.commit()
    resp = _book(client, job["id"], oa["id"])
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "offer_not_pending"


def test_worker_must_still_be_eligible(client, two_offers):
    job, oa, _ = two_offers
    client.patch(f"/api/v1/workers/{oa['worker']['id']}", json={"availability": "unavailable"})
    resp = _book(client, job["id"], oa["id"])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "worker_not_eligible"
    assert _state(client, job["id"])[0] == "estimated"


def test_amount_revalidated_against_current_estimate(client, make_worker, make_job, make_offer):
    job, w = make_job(), make_worker()
    terms = client.get(f"/api/v1/jobs/{job['id']}/offers").json()["offer_terms"]
    offer = make_offer(job["id"], w["id"], kind="counter",
                       labour_amount=terms["permitted_max"]).json()
    # Rates drop and the employer recalculates: the old counter is now above the ceiling.
    card = client.app.state.rate_card
    trades = dict(card.trades)
    trades["plumber"] = card.trades["plumber"].model_copy(update={"hourly_rate": 100,
                                                                  "minimum_charge": 100})
    client.app.state.rate_card = card.model_copy(update={"trades": trades})
    client.post(f"/api/v1/jobs/{job['id']}/price-estimate")
    resp = _book(client, job["id"], offer["id"])
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "offer_out_of_range"
    assert _state(client, job["id"])[0] == "estimated"


def test_concurrent_bookings_only_one_succeeds(client, two_offers):
    job, oa, ob = two_offers
    factory, card = client.app.state.session_factory, client.app.state.rate_card
    barrier = threading.Barrier(2)
    results: dict[str, object] = {}

    def attempt(offer_id: str) -> None:
        with factory() as session:
            barrier.wait()
            try:
                confirm_booking(session, job["id"], BookingCreate(offer_id=offer_id), card=card)
                results[offer_id] = "ok"
            except AppError as exc:
                results[offer_id] = exc.code

    threads = [threading.Thread(target=attempt, args=(o["id"],)) for o in (oa, ob)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)

    assert sorted(results.values()) == ["job_already_booked", "ok"]
    status, offers, n = _state(client, job["id"])
    assert status == "booked" and n == 1
    assert sorted(s for s, _ in offers.values()) == ["accepted", "rejected"]


def test_stale_read_cannot_double_book(client, two_offers):
    """A request that read the job before another booking committed is still rejected."""
    job, oa, ob = two_offers
    factory, card = client.app.state.session_factory, client.app.state.rate_card
    with factory() as stale:
        assert stale.get(Job, job["id"]).status == "estimated"  # cached in this session
        assert _book(client, job["id"], oa["id"]).status_code == 201
        with pytest.raises(JobAlreadyBookedError):
            confirm_booking(stale, job["id"], BookingCreate(offer_id=ob["id"]), card=card)
    assert _state(client, job["id"])[2] == 1


def test_database_rejects_second_booking_row(client, two_offers):
    job, oa, ob = two_offers
    assert _book(client, job["id"], oa["id"]).status_code == 201
    with client.app.state.session_factory() as s:
        s.add(Booking(job_id=job["id"], offer_id=ob["id"], worker_id=ob["worker"]["id"],
                      agreed_labour_amount=100, travel_allowance=0, currency="INR",
                      status="confirmed"))
        with pytest.raises(IntegrityError):
            s.commit()


def test_failed_commit_leaves_no_partial_booking(client, two_offers, monkeypatch):
    job, oa, ob = two_offers

    def broken_commit(self):
        raise OperationalError("COMMIT", {}, Exception("disk I/O error"))

    monkeypatch.setattr(Session, "commit", broken_commit)
    resp = _book(client, job["id"], oa["id"])
    monkeypatch.undo()

    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "database_unavailable"
    status, offers, n = _state(client, job["id"])
    assert status == "estimated" and n == 0
    assert {s for s, _ in offers.values()} == {"pending"}
    assert _book(client, job["id"], oa["id"]).status_code == 201  # still bookable afterwards
