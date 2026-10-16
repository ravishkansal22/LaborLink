"""Live worker location sharing and the employer's tracking view."""

from datetime import timedelta

import pytest
from conftest import EMPLOYER, JOB_LAT, JOB_LNG, NEAR

from app.db import utcnow
from app.models import WorkerLocation
from app.services.tracking import ARRIVED_WITHIN_KM, eta_minutes


def _share(client, ctx, **overrides):
    body = {"worker_id": ctx["worker_id"], **NEAR, "accuracy_m": 15}
    body.update(overrides)
    return client.post(f"/api/v1/jobs/{ctx['job_id']}/worker-location", json=body)


def _view(client, ctx, employer_id=EMPLOYER):
    return client.get(f"/api/v1/jobs/{ctx['job_id']}/worker-location",
                      params={"employer_id": employer_id})


def test_eta_formula():
    assert eta_minutes(0.01) == 1
    assert eta_minutes(2.0) == 8      # 2 km x 1.3 / 20 km/h = 7.8 min -> 8
    assert eta_minutes(10.0) == 39


def test_employer_sees_waiting_state_before_any_location(client, booked_job):
    ctx = booked_job()
    resp = _view(client, ctx)
    assert resp.status_code == 200
    body = resp.json()
    assert body["worker_location"] is None and body["eta_minutes"] is None
    assert body["destination"] == {
        "latitude": JOB_LAT, "longitude": JOB_LNG, "address": "Navrangpura",
    }
    assert body["worker_name"] and body["arrived"] is False


def test_worker_shares_and_employer_sees_distance_and_eta(client, booked_job):
    ctx = booked_job()
    shared = _share(client, ctx)
    assert shared.status_code == 200
    assert shared.json()["distance_km"] == pytest.approx(1.88, abs=0.05)

    body = _view(client, ctx).json()
    loc = body["worker_location"]
    assert (loc["latitude"], loc["longitude"]) == (NEAR["latitude"], NEAR["longitude"])
    assert loc["accuracy_m"] == 15 and loc["stale"] is False
    assert body["eta_minutes"] == eta_minutes(body["distance_km"])
    assert "Approximate" in body["eta_basis"]


def test_only_latest_position_is_kept(client, booked_job):
    ctx = booked_job()
    _share(client, ctx)
    _share(client, ctx, latitude=JOB_LAT + 0.0005, longitude=JOB_LNG)
    with client.app.state.session_factory() as s:
        assert s.query(WorkerLocation).count() == 1
    body = _view(client, ctx).json()
    assert body["distance_km"] <= ARRIVED_WITHIN_KM
    assert body["arrived"] is True and body["eta_minutes"] == 0


def test_stale_location_is_flagged(client, booked_job):
    ctx = booked_job()
    _share(client, ctx)
    with client.app.state.session_factory() as s:
        s.get(WorkerLocation, ctx["job_id"]).recorded_at = utcnow() - timedelta(minutes=5)
        s.commit()
    assert _view(client, ctx).json()["worker_location"]["stale"] is True


def test_in_progress_counts_as_arrived(client, booked_job, flow):
    ctx = booked_job()
    _share(client, ctx)
    flow.start(ctx)
    body = _view(client, ctx).json()
    assert body["job_status"] == "in_progress"
    assert body["arrived"] is True and body["eta_minutes"] == 0


def test_only_booked_worker_can_share(client, booked_job, make_worker):
    ctx = booked_job()
    other = make_worker(display_name="Someone Else")
    resp = _share(client, ctx, worker_id=other["id"])
    assert resp.status_code == 403 and resp.json()["error"]["code"] == "actor_mismatch"


def test_only_job_employer_can_view(client, booked_job):
    ctx = booked_job()
    _share(client, ctx)
    resp = _view(client, ctx, employer_id="employer-intruder")
    assert resp.status_code == 403 and resp.json()["error"]["code"] == "actor_mismatch"
    assert _view(client, ctx, employer_id="bad id!").status_code == 422


def test_tracking_requires_a_booking(client, make_job, make_worker):
    job = make_job(employer_id=EMPLOYER)
    worker = make_worker()
    resp = _share(client, {"job_id": job["id"], "worker_id": worker["id"]})
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "job_not_booked"


def test_tracking_stops_after_the_work_is_handed_over(client, booked_job, flow):
    ctx = flow.to_awaiting(booked_job())
    for resp in (_share(client, ctx), _view(client, ctx)):
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "tracking_not_active"


@pytest.mark.parametrize(
    "overrides", [{"latitude": 91}, {"longitude": -181}, {"accuracy_m": -1}, {"speed": 3}]
)
def test_invalid_location_rejected(client, booked_job, overrides):
    resp = _share(client, booked_job(), **overrides)
    assert resp.status_code == 422


def test_job_without_coordinates_has_no_eta(client, booked_job):
    ctx = booked_job(location={"address": "Somewhere without a pin"})
    _share(client, ctx)
    body = _view(client, ctx).json()
    assert body["destination"] is None and body["distance_km"] is None
    assert body["eta_minutes"] is None
    assert "no map coordinates" in body["eta_basis"]
