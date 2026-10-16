from app.api.v1 import health as health_module


def test_app_starts_and_publishes_openapi(client):
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    paths = resp.json()["paths"]
    assert {
        "/api/v1/health",
        "/api/v1/jobs",
        "/api/v1/jobs/{job_id}",
        "/api/v1/jobs/{job_id}/price-estimate",
        "/api/v1/images",
    } <= set(paths)


def test_startup_creates_database_from_clean_environment(client, settings):
    assert settings.sqlite_path is not None and settings.sqlite_path.exists()
    assert settings.upload_path.is_dir()


def test_health_ok(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["checks"]["database"]["status"] == "ok"
    assert body["work_order_provider"] == "rule_based"
    assert body["rate_card_version"] == "demo-2026-10-v1"


def test_health_reports_database_failure(client, monkeypatch):
    monkeypatch.setattr(health_module, "check_database", lambda _engine: False)
    resp = client.get("/api/v1/health")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["checks"]["database"]["status"] == "unavailable"


def test_unknown_route_uses_error_envelope(client):
    resp = client.get("/api/v1/does-not-exist")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"
