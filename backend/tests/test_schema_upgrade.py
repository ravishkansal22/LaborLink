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
    assert sorted(created) == [
        "bookings", "completion_evidence", "completion_evidence_images", "completion_reviews",
        "job_executions", "offers", "settlements", "worker_locations", "workers",
    ]  # Phase 2 + 3 + tracking tables; jobs.employer_ref already exists in this metadata-built DB
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


PHASE3_TABLES = ["completion_evidence_images", "settlements", "completion_reviews",
                 "completion_evidence", "job_executions"]


def test_app_startup_upgrades_a_phase2_database(settings, make_client):
    from sqlalchemy import text

    # Build a Phase 2-shaped database: everything except the Phase 3 tables and column.
    engine = create_db_engine(settings)
    init_db(engine)
    with engine.begin() as conn:
        for table in PHASE3_TABLES:
            conn.execute(text(f"DROP TABLE {table}"))
        conn.execute(text("DROP INDEX ix_jobs_employer_ref"))
        conn.execute(text("ALTER TABLE jobs DROP COLUMN employer_ref"))
    assert "employer_ref" not in {c["name"] for c in inspect(engine).get_columns("jobs")}
    engine.dispose()

    client = make_client()  # app startup runs init_db, which performs the upgrade
    upgraded = client.app.state.engine
    assert "employer_ref" in {c["name"] for c in inspect(upgraded).get_columns("jobs")}
    assert set(PHASE3_TABLES) <= set(inspect(upgraded).get_table_names())
    assert init_db(upgraded) == []  # nothing left to add
    assert client.get("/api/v1/health").json()["checks"]["database"]["status"] == "ok"


def test_upgrade_preserves_existing_rows(settings):
    from sqlalchemy import text

    engine = create_db_engine(settings)
    init_db(engine)
    with engine.begin() as conn:
        for table in PHASE3_TABLES:
            conn.execute(text(f"DROP TABLE {table}"))
        conn.execute(text("DROP INDEX ix_jobs_employer_ref"))
        conn.execute(text("ALTER TABLE jobs DROP COLUMN employer_ref"))
        conn.execute(text(
            "INSERT INTO jobs (id, status, description, description_source, urgency, address, "
            "created_at, updated_at) VALUES ('legacy-job', 'booked', 'Old job', 'text', "
            "'normal', 'Surat', '2026-10-01 10:00:00', '2026-10-01 10:00:00')"
        ))

    created = init_db(engine)
    assert sorted(created) == sorted([*PHASE3_TABLES, "jobs.employer_ref"])
    with engine.connect() as conn:
        row = conn.execute(text(
            "SELECT id, status, description, employer_ref FROM jobs WHERE id = 'legacy-job'"
        )).one()
    assert tuple(row) == ("legacy-job", "booked", "Old job", None)
    index_names = {i["name"] for i in inspect(engine).get_indexes("jobs")}
    assert "ix_jobs_employer_ref" in index_names
    engine.dispose()
