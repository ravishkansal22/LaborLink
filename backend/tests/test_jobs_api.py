import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.models import Job, PriceEstimateRecord, WorkOrderRecord
from app.schemas.work_order import WorkOrderV1


def _count(client, model) -> int:
    with client.app.state.session_factory() as s:
        return s.scalar(select(func.count()).select_from(model))


def test_create_job_returns_persisted_work_order_and_estimate(client, job_payload):
    resp = client.post("/api/v1/jobs", json=job_payload)
    assert resp.status_code == 201
    body = resp.json()

    assert body["status"] == "estimated"
    assert body["trade"] == "plumber"
    wo = body["work_order"]
    WorkOrderV1.model_validate(wo)  # response conforms to the versioned schema
    assert wo["schema_version"] == "1.0"
    assert wo["trade_source"] == "inferred"
    assert wo["problem_category"] == "leak_repair"
    assert wo["generator"] == {
        "provider": "rule_based", "model": None, "fallback_used": False, "fallback_reason": None
    }

    est = body["price_estimate"]
    assert est["currency"] == "INR"
    assert 0 < est["min_amount"] <= est["max_amount"]
    assert est["is_indicative"] is True
    assert est["assumptions"] and est["wage_floor_check"]["status"] == "not_configured"
    assert body["created_at"].endswith("Z") or "+00:00" in body["created_at"]

    assert _count(client, Job) == 1
    assert _count(client, WorkOrderRecord) == 1
    assert _count(client, PriceEstimateRecord) == 1


def test_job_is_retrievable_from_a_fresh_app_instance(make_client, job_payload):
    created = make_client().post("/api/v1/jobs", json=job_payload).json()
    # A second app on the same database proves the data was persisted, not cached.
    fetched = make_client().get(f"/api/v1/jobs/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == created


def test_get_missing_job_returns_404(client):
    resp = client.get("/api/v1/jobs/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_recalculate_missing_job_returns_404(client):
    resp = client.post("/api/v1/jobs/unknown-id/price-estimate")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize(
    "mutate",
    [
        lambda p: p.update(description=""),
        lambda p: p.update(description="   \n  "),
        lambda p: p.update(description="x" * 2001),
        lambda p: p.update(trade="painter"),
        lambda p: p.update(urgency="asap"),
        lambda p: p.update(description_source="video"),
        lambda p: p.pop("location"),
        lambda p: p.update(location={}),
        lambda p: p.update(location={"latitude": 23.0}),
        lambda p: p.update(location={"latitude": 123.0, "longitude": 72.0}),
        lambda p: p.update(unexpected_field=True),
    ],
)
def test_invalid_job_input_returns_422(client, job_payload, mutate):
    mutate(job_payload)
    resp = client.post("/api/v1/jobs", json=job_payload)
    assert resp.status_code == 422
    err = resp.json()["error"]
    assert err["code"] == "validation_error"
    assert isinstance(err["details"], list) and err["details"]
    assert _count(client, Job) == 0


def test_malformed_json_returns_422(client):
    resp = client.post(
        "/api/v1/jobs", content=b"{not json", headers={"content-type": "application/json"}
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_unknown_image_reference_is_rejected(client, job_payload):
    job_payload["image_id"] = "does-not-exist"
    resp = client.post("/api/v1/jobs", json=job_payload)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_reference"
    assert _count(client, Job) == 0


def test_employer_selected_trade_is_respected(client, job_payload):
    job_payload.update(description="Bedroom door is stuck and the hinge is broken",
                       trade="carpenter")
    body = client.post("/api/v1/jobs", json=job_payload).json()
    assert body["trade"] == "carpenter"
    assert body["request"]["requested_trade"] == "carpenter"
    assert body["work_order"]["trade_source"] == "employer_selected"
    assert body["work_order"]["problem_category"] == "door_window_repair"


def test_incomplete_information_is_flagged(client):
    payload = {"description": "need help asap", "location": {"address": "Surat"}}
    body = client.post("/api/v1/jobs", json=payload).json()
    assert body["status"] == "needs_information"
    assert body["trade"] is None
    assert body["price_estimate"] is None
    wo = body["work_order"]
    assert wo["trade_source"] == "unknown"
    missing = " | ".join(wo["missing_information"])
    assert "trade" in missing.lower()
    assert "photo" in missing.lower()
    assert "coordinates" in missing.lower()
    assert "more detailed description" in missing.lower()
    assert wo["follow_up_questions"]


def test_recalculate_without_trade_returns_409(client):
    payload = {"description": "need help asap", "location": {"address": "Surat"}}
    job_id = client.post("/api/v1/jobs", json=payload).json()["id"]
    resp = client.post(f"/api/v1/jobs/{job_id}/price-estimate")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "trade_required"


def test_recalculate_price_appends_new_current_estimate(client, job_payload):
    created = client.post("/api/v1/jobs", json=job_payload).json()
    job_id, first = created["id"], created["price_estimate"]

    # Rates change (e.g. the rate card was updated): recalculation uses the current card.
    card = client.app.state.rate_card
    new_trades = dict(card.trades)
    new_trades["plumber"] = card.trades["plumber"].model_copy(update={"hourly_rate": 500})
    client.app.state.rate_card = card.model_copy(update={"trades": new_trades,
                                                         "version": "test-v2"})

    resp = client.post(f"/api/v1/jobs/{job_id}/price-estimate")
    assert resp.status_code == 200
    new = resp.json()
    assert new["id"] != first["id"]
    assert new["rate_card_version"] == "test-v2"
    assert new["max_amount"] > first["max_amount"]

    fetched = client.get(f"/api/v1/jobs/{job_id}").json()
    assert fetched["price_estimate"]["id"] == new["id"]
    assert _count(client, PriceEstimateRecord) == 2


def test_recalculation_is_deterministic(client, job_payload):
    job_id = client.post("/api/v1/jobs", json=job_payload).json()["id"]
    a = client.post(f"/api/v1/jobs/{job_id}/price-estimate").json()
    b = client.post(f"/api/v1/jobs/{job_id}/price-estimate").json()
    for key in ("id", "created_at"):
        a.pop(key), b.pop(key)
    assert a == b


def test_urgent_job_costs_more_than_flexible(client, job_payload):
    job_payload["description"] = "Need new concealed pipeline for bathroom fitting"
    prices = {}
    for urgency in ("flexible", "urgent"):
        job_payload["urgency"] = urgency
        prices[urgency] = client.post("/api/v1/jobs", json=job_payload).json()["price_estimate"]
    assert prices["urgent"]["max_amount"] > prices["flexible"]["max_amount"]


def test_database_failure_returns_503_and_persists_nothing(client, job_payload, monkeypatch):
    def broken_commit(self):
        raise OperationalError("COMMIT", {}, Exception("disk I/O error"))

    monkeypatch.setattr(Session, "commit", broken_commit)
    resp = client.post("/api/v1/jobs", json=job_payload)
    monkeypatch.undo()

    assert resp.status_code == 503
    err = resp.json()["error"]
    assert err["code"] == "database_unavailable"
    assert "disk I/O" not in err["message"]  # internal details are not leaked
    assert _count(client, Job) == 0


def test_unexpected_error_returns_generic_500(client, job_payload, monkeypatch):
    from app.services import jobs as job_service

    def boom(*_a, **_k):
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(job_service, "create_job", boom)
    resp = client.post("/api/v1/jobs", json=job_payload)
    assert resp.status_code == 500
    assert resp.json() == {
        "error": {"code": "internal_error", "message": "An unexpected error occurred.",
                  "details": None}
    }
