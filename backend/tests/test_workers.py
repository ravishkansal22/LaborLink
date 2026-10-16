import pytest
from conftest import NEAR


def _body(**overrides) -> dict:
    body = {
        "display_name": "  Sunita   Devi ",
        "trades": ["electrician", "plumber"],
        "years_experience": 6,
        "location": {**NEAR, "locality": "Ellisbridge"},
        "service_radius_km": 7.5,
    }
    body.update(overrides)
    return body


def test_create_and_retrieve_worker(client):
    resp = client.post("/api/v1/workers", json=_body())
    assert resp.status_code == 201
    w = resp.json()
    assert w["display_name"] == "Sunita Devi"
    assert w["trades"] == ["electrician", "plumber"]
    assert w["availability"] == "available"  # default
    assert w["verification_status"] == "unverified"
    assert w["location"] == {**NEAR, "locality": "Ellisbridge"}
    assert w["service_radius_km"] == 7.5

    fetched = client.get(f"/api/v1/workers/{w['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == w


def test_get_unknown_worker_returns_404(client):
    resp = client.get("/api/v1/workers/nope")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize(
    "overrides",
    [
        {"trades": []},
        {"trades": ["painter"]},
        {"trades": ["plumber", "plumber"]},
        {"trades": ["plumber", "mason", "carpenter", "electrician", "plumber"]},
        {"location": {"latitude": 91, "longitude": 72.5}},
        {"location": {"latitude": 23.0, "longitude": -181}},
        {"location": {"latitude": 23.0}},
        {"location": None},
        {"service_radius_km": 0},
        {"service_radius_km": 51},
        {"years_experience": -1},
        {"years_experience": 61},
        {"availability": "busy"},
        {"display_name": " x "},
        {"verified": True},
    ],
)
def test_invalid_worker_input_returns_422(client, overrides):
    resp = client.post("/api/v1/workers", json=_body(**overrides))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_availability_update_is_persisted(client, make_worker):
    w = make_worker()
    resp = client.patch(f"/api/v1/workers/{w['id']}", json={"availability": "unavailable"})
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["availability"] == "unavailable"
    assert updated["display_name"] == w["display_name"]  # untouched fields unchanged
    assert updated["updated_at"] >= w["updated_at"]
    assert client.get(f"/api/v1/workers/{w['id']}").json()["availability"] == "unavailable"


def test_partial_profile_update(client, make_worker):
    w = make_worker()
    resp = client.patch(f"/api/v1/workers/{w['id']}", json={
        "trades": ["mason"], "years_experience": None, "service_radius_km": 3,
        "location": {"latitude": 23.1, "longitude": 72.6},
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["trades"] == ["mason"]
    assert body["years_experience"] is None
    assert body["service_radius_km"] == 3
    assert body["location"] == {"latitude": 23.1, "longitude": 72.6, "locality": None}


@pytest.mark.parametrize(
    "patch",
    [{}, {"display_name": None}, {"availability": None}, {"trades": []}, {"unknown": 1}],
)
def test_invalid_updates_rejected(client, make_worker, patch):
    w = make_worker()
    resp = client.patch(f"/api/v1/workers/{w['id']}", json=patch)
    assert resp.status_code == 422


def test_update_unknown_worker_returns_404(client):
    resp = client.patch("/api/v1/workers/nope", json={"availability": "available"})
    assert resp.status_code == 404


def test_cors_allows_patch_from_configured_origin(client, make_worker):
    w = make_worker()
    resp = client.options(f"/api/v1/workers/{w['id']}", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "PATCH",
    })
    assert resp.status_code == 200
    assert "PATCH" in resp.headers["access-control-allow-methods"]
