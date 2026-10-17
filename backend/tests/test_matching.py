import pytest
from conftest import FAR, JOB_LAT, JOB_LNG, NEAR

from app.models import Job, Worker
from app.services.matching import NO_JOB_COORDINATES, assess, haversine_km, rank_key


def _worker(**kw) -> Worker:
    base = dict(id="w", display_name="W", trades=["plumber"], years_experience=None,
                latitude=JOB_LAT, longitude=JOB_LNG, service_radius_km=10.0,
                availability="available")
    base.update(kw)
    return Worker(**base)


def _job(**kw) -> Job:
    base = dict(id="j", status="estimated", trade="plumber", latitude=JOB_LAT, longitude=JOB_LNG)
    base.update(kw)
    return Job(**base)


# --- unit: distance, eligibility and scoring ---------------------------------------------------

def test_haversine_known_distances():
    assert haversine_km(0, 0, 0, 1) == pytest.approx(111.195, abs=0.01)
    assert haversine_km(JOB_LAT, JOB_LNG, JOB_LAT, JOB_LNG) == 0
    assert haversine_km(JOB_LAT, JOB_LNG, FAR["latitude"], FAR["longitude"]) > 20


def test_score_formula():
    a = assess(_worker(years_experience=10), _job())
    assert a.eligible and a.distance_km == 0
    assert a.breakdown == {"distance": 60.0, "experience": 40.0} and a.score == 100.0

    a = assess(_worker(years_experience=25), _job())
    assert a.breakdown["experience"] == 40.0  # capped at 10 years

    half = assess(_worker(latitude=JOB_LAT + 0.045, service_radius_km=10), _job())
    assert half.distance_km == pytest.approx(5.0, abs=0.01)
    assert half.breakdown["distance"] == pytest.approx(30.0, abs=0.1)
    assert "Experience not provided." in half.limitations


@pytest.mark.parametrize(
    "worker_kw, issue",
    [
        ({"trades": ["mason"]}, "trade_mismatch"),
        ({"availability": "unavailable"}, "unavailable"),
        ({**FAR, "service_radius_km": 10}, "outside_service_radius"),
    ],
)
def test_ineligible_workers(worker_kw, issue):
    a = assess(_worker(**worker_kw), _job())
    assert not a.eligible and a.issues == [issue]


def test_missing_job_coordinates_never_invents_distance():
    a = assess(_worker(**FAR, years_experience=4), _job(latitude=None, longitude=None))
    assert a.eligible
    assert a.distance_km is None and a.within_radius is None
    assert a.breakdown["distance"] == 0
    assert NO_JOB_COORDINATES in a.limitations


def test_ranking_is_deterministic_with_tie_breaks():
    job = _job()
    workers = [
        _worker(id="b", years_experience=5),
        _worker(id="a", years_experience=5),  # identical to b -> id breaks the tie
        _worker(id="c", years_experience=5, latitude=JOB_LAT + 0.01),  # slightly farther
        _worker(id="d", years_experience=10, latitude=JOB_LAT + 0.01),  # more experience
    ]
    order = [w.id for w in sorted(workers, key=lambda w: rank_key(w, assess(w, job)))]
    assert order == ["d", "a", "b", "c"]
    assert order == [w.id for w in sorted(reversed(workers),
                                          key=lambda w: rank_key(w, assess(w, job)))]


# --- API: /jobs/{id}/matches ------------------------------------------------------------------

def test_matches_filters_and_ranks(client, make_worker, make_job):
    job = make_job()
    best = make_worker(display_name="Expert Near", years_experience=10)
    ok = make_worker(display_name="Junior Near", years_experience=1)
    make_worker(display_name="Mason", trades=["mason"])
    make_worker(display_name="Away", availability="unavailable")
    make_worker(display_name="Far", location=FAR, service_radius_km=5)

    resp = client.get(f"/api/v1/jobs/{job['id']}/matches")
    assert resp.status_code == 200
    body = resp.json()
    assert body["distance_matching"] == "complete"
    assert [c["worker"]["id"] for c in body["candidates"]] == [best["id"], ok["id"]]
    assert body["excluded"] == {"trade_mismatch": 1, "unavailable": 1,
                                "outside_service_radius": 1}
    top = body["candidates"][0]
    assert top["within_service_radius"] is True and top["distance_km"] < 3
    assert any("plumber" in r for r in top["reasons"])
    assert "latitude" not in top["worker"]  # worker coordinates are not exposed
    assert "Price is not used" in body["scoring"]
    assert client.get(f"/api/v1/jobs/{job['id']}/matches").json() == body  # deterministic


def test_matches_with_missing_job_coordinates(client, make_worker, make_job):
    job = make_job(location={"address": "Satellite, Ahmedabad"})
    w = make_worker(location=FAR, service_radius_km=2)
    body = client.get(f"/api/v1/jobs/{job['id']}/matches").json()
    assert body["distance_matching"] == "unavailable"
    assert NO_JOB_COORDINATES in body["limitations"]
    [cand] = body["candidates"]
    assert cand["worker"]["id"] == w["id"]
    assert cand["distance_km"] is None and cand["within_service_radius"] is None


def test_no_candidates_is_graceful(client, make_job):
    job = make_job()
    resp = client.get(f"/api/v1/jobs/{job['id']}/matches")
    assert resp.status_code == 200
    body = resp.json()
    assert body["candidates"] == []
    assert any("No available worker" in lim for lim in body["limitations"])


def test_matches_errors(client, make_job):
    assert client.get("/api/v1/jobs/nope/matches").status_code == 404
    unknown = make_job(description="need help asap", location={"address": "Surat"})
    resp = client.get(f"/api/v1/jobs/{unknown['id']}/matches")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "trade_required"
    assert client.get(f"/api/v1/jobs/{unknown['id']}/matches?limit=0").status_code == 422


# --- API: /workers/{id}/jobs (discovery) -------------------------------------------------------

def test_worker_discovers_relevant_open_jobs(client, make_worker, make_job):
    plumber = make_worker()
    near_job = make_job()
    no_coords = make_job(location={"address": "Somewhere"})
    make_job(description="Cracks in the bedroom wall need patch work")  # mason job
    far_job = make_job(location={"address": "Far", **FAR})
    make_job(description="need help asap", location={"address": "Surat"})  # needs_information

    body = client.get(f"/api/v1/workers/{plumber['id']}/jobs").json()
    ids = [i["job_id"] for i in body["items"]]
    assert ids == [near_job["id"], no_coords["id"]]  # nearest first, unknown distance last
    assert far_job["id"] not in ids
    item = body["items"][0]
    assert item["trade"] == "plumber" and item["distance_km"] < 3
    assert "address" not in item and "request" not in item  # employer details not exposed
    terms = item["offer_terms"]
    assert terms["permitted_min"] <= terms["suggested_labour_amount"] <= terms["permitted_max"]
    assert body["items"][1]["limitations"] == [NO_JOB_COORDINATES]


def test_worker_sees_the_employers_photo_and_description(client, make_worker, make_job,
                                                         png_bytes):
    plumber = make_worker()
    upload = {"file": ("tap.png", png_bytes, "image/png")}
    image = client.post("/api/v1/images", files=upload).json()
    job = make_job(image_id=image["id"])
    without_photo = make_job()

    listed = client.get(f"/api/v1/workers/{plumber['id']}/jobs").json()["items"]
    items = {i["job_id"]: i for i in listed}
    assert items[job["id"]]["image_id"] == image["id"]
    assert items[job["id"]]["description"] == "Kitchen sink tap is leaking and dripping all night"
    assert items[without_photo["id"]]["image_id"] is None
    photo = client.get(f"/api/v1/images/{image['id']}")
    assert photo.status_code == 200 and photo.content == png_bytes


def test_unavailable_worker_sees_no_jobs(client, make_worker, make_job):
    w = make_worker(availability="unavailable")
    make_job()
    body = client.get(f"/api/v1/workers/{w['id']}/jobs").json()
    assert body["items"] == [] and body["worker_availability"] == "unavailable"
    assert body["limitations"]


def test_discovery_flags_active_offer_and_hides_booked_jobs(client, make_worker, make_job,
                                                            make_offer):
    w = make_worker()
    job = make_job()
    offer = make_offer(job["id"], w["id"]).json()
    [item] = client.get(f"/api/v1/workers/{w['id']}/jobs").json()["items"]
    assert item["has_active_offer"] is True
    client.post(f"/api/v1/jobs/{job['id']}/bookings", json={"offer_id": offer["id"]})
    assert client.get(f"/api/v1/workers/{w['id']}/jobs").json()["items"] == []


def test_discovery_unknown_worker(client):
    assert client.get("/api/v1/workers/nope/jobs").status_code == 404


def test_near_constant_is_within_default_radius():
    assert haversine_km(JOB_LAT, JOB_LNG, NEAR["latitude"], NEAR["longitude"]) < 3
