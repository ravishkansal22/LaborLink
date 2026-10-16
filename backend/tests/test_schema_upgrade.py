"""Upgrading a Phase 1 database adds the Phase 2 tables without touching existing data."""

from conftest import JOB_LAT, JOB_LNG, NEAR
from sqlalchemy import inspect

from app.db import Base, create_db_engine, create_session_factory, init_db
from app.schemas.jobs import JobCreate
from app.services.jobs import create_job
from app.services.pricing import load_rate_card
from app.services.work_orders import RuleBasedProvider, WorkOrderService

PHASE1_TABLES = ["image_uploads", "jobs", "work_orders", "price_estimates"]


def test_phase1_database_is_upgraded_in_place(settings, make_client):
    engine = create_db_engine(settings)
    from app import models  # noqa: F401

    Base.metadata.create_all(engine, tables=[Base.metadata.tables[t] for t in PHASE1_TABLES])
    with create_session_factory(engine)() as s:
        job = create_job(
            s,
            JobCreate(description="Kitchen tap leaking badly",
                      location={"address": "Navrangpura", "latitude": JOB_LAT,
                                "longitude": JOB_LNG}),
            work_orders=WorkOrderService(RuleBasedProvider()),
            rate_card=load_rate_card(settings.rate_card_file),
            upload_dir=settings.upload_path,
        )
        job_id = job.id
    assert set(inspect(engine).get_table_names()) == set(PHASE1_TABLES)

    created = init_db(engine)
    assert sorted(created) == ["bookings", "offers", "workers"]
    assert init_db(engine) == []  # idempotent
    index_names = {i["name"] for i in inspect(engine).get_indexes("offers")}
    assert "uq_offers_active_worker_job" in index_names
    engine.dispose()

    # The pre-existing job is intact and works with Phase 2 features.
    client = make_client()
    before = client.get(f"/api/v1/jobs/{job_id}")
    assert before.status_code == 200 and before.json()["status"] == "estimated"
    worker = client.post("/api/v1/workers", json={
        "display_name": "Ramesh", "trades": ["plumber"], "location": NEAR,
    }).json()
    offer = client.post(f"/api/v1/jobs/{job_id}/offers",
                        json={"worker_id": worker["id"], "kind": "accept_suggested"})
    assert offer.status_code == 201
