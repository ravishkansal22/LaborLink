# Implementation Progress

Tracks what has actually been built, verified and deferred. Update this file at the end of every phase.

---

## Phase 1 — Pre-implementation assessment (2026-10-16)

Recorded before any Phase 1 code was written.

### 1. What already existed

| Area | State at start of Phase 1 |
|---|---|
| Git | Repository `LaborLink/` on `main`, one commit (`e289f13 basic codebase added`), **clean working tree** — no pre-existing user modifications to preserve. |
| `backend/` | Only `.gitkeep`. No code, dependencies, database, migrations, routes or tests. |
| `frontend/` | Only `.gitkeep`. There is **no frontend code and therefore no existing API contract** to match. Left untouched. |
| `docs/` | `README.md` (doc index & contributor policy), `CHANGELOG.md` (team change log with a template), `EXECUTION_GUIDE.md` (generic run/test steps). No project overview, architecture or API docs yet. |
| Tooling | `.venv` with Python 3.10.9 and no third-party packages; `.vscode/settings.json` points at it. `.gitignore` already ignores `.env`, `var/`, `__pycache__/`, `.pytest_cache/`. |

### 2. What was missing for Phase 1

Everything on the backend: application entry point, settings, database layer, models, schemas, job-intake workflow, work-order generation, FairRate pricing, error handling, health check, tests and backend documentation.

### 3. Decisions preserved

- Three-directory layout (`frontend/`, `backend/`, `docs/`) and the shared root `.venv`.
- Contributor process in `docs/README.md` / `docs/CHANGELOG.md` (entries appended, not rewritten).
- `EXECUTION_GUIDE.md` remains the single setup/run guide (extended, not duplicated).
- Existing `.gitignore` rules (`var/` is reused as the local runtime-data folder for the SQLite DB and uploads).

### 4. Files to create / modify

- **Create** `backend/` package: `app/` (config, db, models, errors, schemas, services, api/v1), `app/data/rate_card.json`, `tests/`, `requirements.txt`, `pyproject.toml`, `.env.example`.
- **Create** docs: `PROJECT_OVERVIEW.md`, `BACKEND_ARCHITECTURE.md`, `API.md`, this file.
- **Modify** docs: `README.md` (index), `EXECUTION_GUIDE.md` (real commands), `CHANGELOG.md` (new entry).
- **No changes** under `frontend/`.

### 5. Proposed Phase 1 API contract

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health` | App + database + provider + rate-card status |
| POST | `/api/v1/images` | Optional photo upload (JPEG/PNG/WebP, size-limited) → `image_id` |
| POST | `/api/v1/jobs` | Job intake → persisted job + structured work order + price estimate |
| GET | `/api/v1/jobs/{job_id}` | Retrieve a persisted job |
| POST | `/api/v1/jobs/{job_id}/price-estimate` | Recalculate the estimate from persisted job details |

Voice input is accepted as a transcript (`description_source: "voice_transcript"`); no speech-recognition infrastructure in Phase 1.

### 6. Dependencies / external services that could block

- **Vision-language model:** no credentials are available in this environment. A replaceable provider interface is used, with a deterministic, clearly-labelled rule-based provider as the default and as the automatic fallback. An optional Anthropic (Claude) provider is wired through environment configuration; it is exercised in tests only with a mocked client, so **real image understanding is not verified**.
- **Wage data:** no verified jurisdiction-specific minimum-wage data is available. The rate card ships illustrative rates and an empty `wage_floors` table; every estimate reports that the wage-floor check is `not_configured` instead of inventing legal figures.
- No database server is needed (SQLite).

---

## Phase 1 — Status: COMPLETE (2026-10-16)

### Objectives
Backend foundation; job intake (text or voice transcript, optional photo, optional trade, location,
urgency); validated structured work order; deterministic, explainable FairRate estimate;
persistence and retrieval; recalculation; tests and docs.

### Completed functionality
- FastAPI app factory with centralised settings (`LABORLINK_*` env vars / `backend/.env`),
  SQLite via SQLAlchemy 2.0, tables created on startup or with `python -m app.init_db`.
- `/api/v1` routes with OpenAPI docs at `/docs`; consistent `{"error": {...}}` envelope.
- Work orders validated against versioned `WorkOrderV1` before storage.
- Rule-based generator (default, offline, deterministic, Hindi/Hinglish keywords) and optional
  Claude vision provider, with automatic fallback recorded in `generator.fallback_used/reason`.
- Missing information and follow-up questions surfaced (unknown trade, generic problem, no photo,
  no coordinates, very short description, employer trade conflicting with description).
- FairRate pricing from `app/data/rate_card.json`: labour range, travel allowance, multipliers,
  minimum charge, assumptions, warnings, wage-floor check (`not_configured` by default).
- Optional photo upload with signature-based type check, size limit, server-generated file
  names, storage in git-ignored `backend/var/uploads`.
- Transactions: a job, its work order and estimate are committed together; DB errors roll back and
  return 503 with nothing persisted.

### API endpoints implemented
`GET /api/v1/health`, `POST /api/v1/images`, `POST /api/v1/jobs`, `GET /api/v1/jobs/{job_id}`,
`POST /api/v1/jobs/{job_id}/price-estimate` — see [API.md](./API.md).

### Database models implemented
`jobs`, `work_orders`, `price_estimates` (append-only history), `image_uploads` — see
[BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md#data-model).

### Files added / changed
- Added: `backend/requirements.txt`, `backend/pyproject.toml`, `backend/.env.example`,
  `backend/app/**` (config, db, init_db, main, models, errors, api/, schemas/, services/,
  data/rate_card.json), `backend/tests/**` (6 test modules + conftest).
- Added docs: `PROJECT_OVERVIEW.md`, `BACKEND_ARCHITECTURE.md`, `API.md`, this file.
- Updated docs: `README.md`, `EXECUTION_GUIDE.md`, `CHANGELOG.md`.
- `frontend/`: **no changes** (verified with `git status`).

### Tests and checks actually executed (2026-10-16, Python 3.10.9, Windows)

| Check | Result |
|---|---|
| `python -m pytest` | **87 passed** (test_app 5, test_images 7, test_jobs_api 25, test_pricing 11, test_providers 17, test_work_order 22) |
| `python -m ruff check .` | All checks passed |
| `python -m app.init_db` on a clean checkout | Created `backend/var/laborlink.db` and `backend/var/uploads/` |
| `python -m uvicorn app.main:app` + curl | `GET /api/v1/health` 200, `POST /api/v1/jobs` 201, `GET /docs` 200 |

Coverage by requirement: startup/OpenAPI, health (ok and DB-down 503), valid creation, 11 invalid
inputs + malformed JSON, persistence across separate app instances, missing ids (404 on get and
recalc), schema validation (7 rejection cases), pricing formula/rounding/minimum charge/
multipliers/wage floors/rate-card validation, incomplete information, provider failure fallback
(service-level, API-level, Anthropic error mapping with a fake client), DB commit failure (503,
nothing persisted), unexpected error (generic 500), recalculation (new current estimate, history
kept, deterministic, 409 without trade), uploads (valid, spoofed type, empty, oversized,
sanitised filename).

Not executed: any call to the live Anthropic API (no credentials; tests never make paid calls).

### Intentionally deferred
- Speech-to-text (the API accepts transcripts), real-time photo analysis without credentials.
- Authentication and user accounts; worker profiles, matching, bidding, booking (Phase 2).
- Completion evidence, payments, Kamai Passbook (Phase 3).
- Database migrations (Alembic) — tables are created with `create_all`.
- Editing a job after creation (e.g. supplying a trade for a `needs_information` job).

### Known limitations
- **Rule-based classification** is keyword-based: it handles common phrasings of the four trades
  but will misclassify unusual descriptions; ties are resolved deterministically and flagged with
  lower confidence.
- **Anthropic provider is unverified against the live API** (tested only with mocks). Real image
  understanding has not been demonstrated.
- **Rates are illustrative**, not market data; no statutory wage floors are configured.
- Travel is a flat allowance; materials are excluded from estimates.
- A job whose trade could not be determined cannot be repriced; the employer must create it again
  with a trade selected.
- Uploaded photos are stored but not served back by the API; there is no cleanup of unreferenced
  uploads.
- No authentication: local/demo use only. SQLite is single-node and not intended for production
  concurrency.

### Exact next steps for Phase 2

> Outcome (see Phase 2 below): steps 2–6 were implemented (bids are called *offers*; the
> `estimated` status serves as "open"). Steps 1 (Alembic), 7 (distance-based travel) and 8
> (authentication) were deferred; the schema change was kept additive so no migration was needed.
1. Add Alembic and an initial migration matching the Phase 1 schema.
2. `workers` table (name, trades, skills, home lat/lng, service radius, availability) with
   create/get endpoints and seed data for demos.
3. Matching service: haversine distance from `jobs.latitude/longitude`, filter by trade and radius,
   rank by distance (and later rating); `GET /api/v1/jobs/{id}/matches`.
4. Job discovery for workers: `GET /api/v1/workers/{id}/jobs` (open jobs nearby).
5. Bids: `bids` table (job, worker, amount, message, status) with counter-offer validation against
   the current FairRate range; endpoints to create/list/accept.
6. Booking: accepting a bid creates a `bookings` row and moves the job `estimated → booked`; add the
   new `JobStatus` values and transition checks.
7. Replace the flat travel allowance with a distance-based component once worker locations exist.
8. Minimal authentication (e.g. per-role tokens) before any shared/demo deployment.

---

## Phase 2 — Pre-implementation assessment (2026-10-16)

### Baseline (verified before any Phase 2 edit)
- Git: `main` at `899c429 backend foundation implemented`, clean working tree (Phase 1 committed by the team; no uncommitted work to preserve).
- `python -m pytest`: **87 passed**. `python -m ruff check .`: clean.
- `frontend/` still contains only `.gitkeep` — no frontend API expectations to honour.

### Schema changes needed
- **New tables only:** `workers`, `offers`, `bookings`. No column is added to or removed from the
  Phase 1 tables, so the existing `create_all` initialisation is a safe, additive upgrade: it
  creates missing tables and never drops or alters existing ones. Existing jobs, work orders,
  estimates and uploads are untouched.
- `jobs.status` is a plain string column; the new `booked` status needs no schema change.
- Constraints: `bookings.job_id` UNIQUE (one booking per job); partial unique index on
  `offers(job_id, worker_id) WHERE status = 'pending'` (one active offer per worker per job);
  foreign keys from offers/bookings to jobs/workers; positive-amount CHECKs.

### Plan
- Lifecycle: `needs_information` (not discoverable) → `estimated` (= open for matching and
  offers) → `booked`. `in_progress`/`completed` are reserved for Phase 3 and not implemented.
  Phase 1 recalculation is blocked once a job is booked (it previously reset status to `estimated`).
- Offer limits come from a new `offer_limits` block in the existing rate card and are applied to
  the job's **current FairRate estimate**; no second pricing formula.
- Matching: haversine distance, filters on trade / availability / service radius, transparent
  score from distance and experience (never price), deterministic tie-breaks.
- Booking: one transaction with a conditional `UPDATE jobs … WHERE status='estimated'` plus the
  unique booking constraint, so only one of two concurrent bookings can succeed.

## Phase 2 — Status: COMPLETE (2026-10-16)

Phase 1 functionality (above) is unchanged except for one deliberate rule: recalculating the
estimate of a `booked` job now returns `409 job_not_open`.

### Completed functionality (Phase 2 only)
- **Worker profiles** — create, retrieve, partial update (including availability); validated
  trades, coordinates, radius (0–50 km), experience (0–60 years); always `unverified`.
- **Matching** — `GET /jobs/{id}/matches`: trade + availability + haversine distance within the
  worker's service radius; transparent 0–100 score (distance ≤ 60, experience ≤ 40, never price);
  deterministic tie-breaks; excluded-worker counts; explicit `distance_matching: "unavailable"`
  when the job has no coordinates.
- **Job discovery** — `GET /workers/{id}/jobs`: open jobs for the worker's trades and area,
  nearest first, offer terms included, employer address hidden; polling only.
- **Offers** — accept the suggested amount or counter within rate-card `offer_limits` applied to
  the job's current FairRate estimate (`pricing.offer_terms`, no second formula); eligibility,
  estimate validity and duplicate checks; employer comparison view (oldest first, with distance,
  match score, difference from suggested); worker's own offer list.
- **Booking** — one transaction: conditional `estimated → booked` update, booking row (UNIQUE
  `job_id`), selected offer `accepted`, competing offers `rejected` (`another_offer_booked`).
- **Lifecycle** — `needs_information`, `estimated` (open), `booked`; transitions validated in
  `services/lifecycle.py`.

### API endpoints added
`POST /api/v1/workers`, `GET /api/v1/workers/{worker_id}`, `PATCH /api/v1/workers/{worker_id}`,
`GET /api/v1/workers/{worker_id}/jobs`, `GET /api/v1/workers/{worker_id}/offers`,
`GET /api/v1/jobs/{job_id}/matches`, `POST /api/v1/jobs/{job_id}/offers`,
`GET /api/v1/jobs/{job_id}/offers`, `POST /api/v1/jobs/{job_id}/bookings`,
`GET /api/v1/jobs/{job_id}/booking` — see [API.md](./API.md#phase-2--workers-matching-offers-and-booking).

### Database changes
New tables `workers`, `offers`, `bookings` (FKs to `jobs`, `workers`, `price_estimates`,
`offers`; CHECK constraints; `bookings.job_id` and `bookings.offer_id` UNIQUE; partial unique
index `uq_offers_active_worker_job`). No Phase 1 table or column changed. Existing databases are
upgraded in place by `python -m app.init_db` or server start (additive `create_all`).

### Files added / changed in Phase 2
- Added: `app/api/v1/workers.py`, `app/api/v1/marketplace.py`, `app/schemas/workers.py`,
  `app/schemas/marketplace.py`, `app/services/{lifecycle,workers,matching,discovery,offers,bookings}.py`,
  `tests/test_{workers,matching,offers,bookings,schema_upgrade}.py`.
- Changed: `app/models.py` (new models), `app/schemas/common.py` (new enums, `booked`),
  `app/schemas/pricing.py` + `app/data/rate_card.json` (`offer_limits`, `OfferTerms`),
  `app/services/pricing.py` (`offer_terms`), `app/services/jobs.py` (recalculation guard),
  `app/services/db_guard.py` (optional integrity-error mapping), `app/db.py` + `app/init_db.py`
  (report created tables), `app/main.py` (CORS PATCH, log created tables),
  `app/api/v1/__init__.py` (routers), `tests/conftest.py` (helper fixtures only).
- Phase 1 test files: unchanged. `frontend/`: unchanged.

### Tests and checks actually executed (2026-10-16)

| Check | Result |
|---|---|
| Baseline before any change | `pytest`: 87 passed; `ruff`: clean |
| `python -m pytest` after Phase 2 | **165 passed** — Phase 1: test_app 5, test_images 7, test_jobs_api 25, test_pricing 11, test_providers 17, test_work_order 22 (87, unchanged); Phase 2: test_workers 26, test_matching 16, test_offers 24, test_bookings 11, test_schema_upgrade 1 (78) |
| Concurrency tests repeated 25× | 25/25 passed (after fixing the error code returned to the losing request) |
| `python -m ruff check .` | All checks passed |
| `python -m app.init_db` + `uvicorn app.main:app` (scratch DB) | Tables created; health 200; worker and job creation 201; OpenAPI lists all 15 routes |

Coverage highlights: profile validation (15 invalid cases), availability/partial updates, CORS
PATCH preflight; haversine, score formula, eligibility rules, missing coordinates, deterministic
tie-breaks, empty results; offer terms arithmetic and configurability, range bounds, payload
rules, unknown job/worker, duplicate (API and DB index), ineligible worker (3 reasons), missing
and corrupt estimates, listings; valid booking, reference errors, mismatch, offer not pending,
worker no longer eligible, amount re-validation after recalculation, second booking, threaded race,
stale read, DB UNIQUE guard, failed commit leaving no partial state; in-place upgrade of a
Phase 1-only database.

The team's development database (`backend/var/laborlink.db`) was not opened or modified during
verification; it will gain the three new tables the next time the server or `init_db` runs.

### Known limitations (Phase 2)
- **No authentication/authorisation** — any caller can act as any worker or employer. Demo only.
- Profiles and experience are self-declared and unverified; no ratings (no rating records exist).
- Matching scans all workers in Python — fine for a demo, not for large datasets.
- Travel remains a flat allowance; distance is used for eligibility and ranking only.
- Offers cannot be edited or withdrawn; bookings cannot be cancelled.
- A `needs_information` job can never become open (no job-editing endpoint).
- No notifications; clients poll.
- Worker coordinates are returned by `GET /workers/{id}` to anyone with the id.
- Schema upgrades rely on additive `create_all`; Alembic is still needed before altering tables.

### Intentionally not implemented (Phase 3)
Job start/in-progress, completion evidence, completion confirmation, payment settlement or
escrow, Kamai Passbook, earnings records.

### Next steps for Phase 3

> Outcome (see Phase 3 below): steps 2–6 were implemented. Step 1 (Alembic) was not needed
> because the change stayed additive (new tables + one nullable column via `ADD COLUMN`); step 7
> (authentication) remains deferred.
1. Add Alembic and a baseline migration of the current schema before any table change.
2. Extend `JobStatus`/`BookingStatus` with `in_progress` and `completed`, plus transitions in
   `services/lifecycle.py` (`booked → in_progress → completed`).
3. Completion evidence: reuse the image-upload pipeline; `completion_evidence` table linked to
   `bookings`.
4. Employer confirmation endpoint that moves the booking/job to `completed`.
5. Simulated settlement record (clearly labelled as simulated) for the agreed amount.
6. Kamai Passbook: append-only earnings entries per worker, read endpoint and summary.
7. Before any shared deployment: minimal authentication and ownership checks.

---

## Phase 3 — Pre-implementation assessment (2026-10-16)

### Baseline (verified before any Phase 3 edit)
- Git: `main` at `72bac46 worker related backend changes`, clean working tree (Phase 2 committed
  by the team; no uncommitted work to preserve). `frontend/` still contains only `.gitkeep`.
- `python -m pytest`: **165 passed**. `python -m ruff check .`: clean. SQLite 3.39.4.

### Gap found: no employer identity
Jobs have no employer reference, so "only the job's employer may confirm" cannot be expressed.
Decision: add an optional, self-asserted `employer_id` (stored as `jobs.employer_ref`). It can be
given when the job is created (`POST /jobs`) or, for jobs created without one, when the booking is
confirmed (`POST /jobs/{id}/bookings`). Both fields are optional, so Phase 1/2 requests remain
valid. Like `worker_id`, it is an **unverified label, not authentication**.

### Schema changes
- One nullable column on an existing table: `jobs.employer_ref`. Added by an explicit, idempotent
  `ALTER TABLE jobs ADD COLUMN employer_ref …` step in `init_db` (SQLite supports this without
  rewriting the table or touching existing rows). `create_all` cannot add columns.
- New tables only otherwise: `job_executions` (start), `completion_evidence` +
  `completion_evidence_images` (FKs to `image_uploads`), `completion_reviews` (confirm/dispute,
  UNIQUE job), `settlements` (UNIQUE job and UNIQUE booking, status CHECK).

### Plan
- Lifecycle: `booked → in_progress → awaiting_confirmation → completed | disputed`, transitions
  centralised in `services/lifecycle.py` and applied with conditional `UPDATE … WHERE status=…`.
  `disputed` is terminal in Phase 3 (resolution deferred).
- Actors: `worker_id` must equal the booking's worker (start, evidence); `employer_id` must equal
  the job's recorded employer (confirm/dispute, settle) — otherwise `403 actor_mismatch`.
- Evidence: one immutable submission per job, referencing images already uploaded through
  `POST /images` (no new storage code); at least one "after" photo.
- Confirmation creates the review and a `simulated_pending` settlement for the booking's agreed
  total in the same transaction; a dispute creates no settlement. `POST /settlement` moves it to
  `simulated_settled` once (conditional update). No amount is ever accepted from the client.
- Kamai Passbook computed on each request from bookings, reviews and settlements (no stored
  running totals).

## Phase 3 — Status: COMPLETE (2026-10-16)

Marked complete after the full suite (233 tests) and Ruff passed and the documented demo was run
against a live server (details below). Phase 1 and Phase 2 behaviour is unchanged apart from
additive fields (`employer_id` on jobs and booking requests).

### Completed functionality (Phase 3 only)
- **Execution lifecycle** — `booked → in_progress → awaiting_confirmation → completed | disputed`,
  defined once in `services/lifecycle.py` and applied with conditional updates.
- **Actor checks (prototype)** — booked worker for start/evidence; the job's recorded employer for
  confirm/dispute/settle; `403 actor_mismatch` otherwise. Self-asserted labels, not authentication.
- **Completion evidence** — before (0–5) and after (1–5) photos referencing existing uploads from
  `POST /images`, optional note; one immutable submission per job; retrieval endpoint.
- **Employer review** — confirm (records agreed amounts, job `completed`, creates a
  `simulated_pending` settlement) or dispute (reason recorded, job `disputed`, no settlement).
  One final decision per job.
- **Simulated settlement** — amount copied from the booking; client amounts rejected;
  `simulated_pending → simulated_settled` exactly once; disputed/unconfirmed jobs refused.
- **Kamai Passbook** — per-worker entries and summary computed from bookings, reviews and
  settlements on each request.

### API endpoints added
`POST /api/v1/jobs/{job_id}/start`, `POST|GET /api/v1/jobs/{job_id}/completion-evidence`,
`POST /api/v1/jobs/{job_id}/completion-confirmation`, `POST|GET /api/v1/jobs/{job_id}/settlement`,
`GET /api/v1/workers/{worker_id}/passbook` — see
[API.md](./API.md#phase-3--job-completion-simulated-settlement-and-kamai-passbook).
Additive changes to existing endpoints: optional `employer_id` in `POST /jobs` and
`POST /jobs/{id}/bookings`; `employer_id` in `JobResponse`.

**Design decision:** settlement is split across two calls. Confirmation creates the
`simulated_pending` record in its own transaction (so the job is eligible and the amount is fixed
from the booking at that moment); `POST /settlement` records the simulated payout. This lets the
demo show pending → settled while guaranteeing a settlement can never exist without confirmation.

### Database changes
- New tables: `job_executions`, `completion_evidence`, `completion_evidence_images`,
  `completion_reviews`, `settlements` (UNIQUE job/booking constraints, CHECK constraints on
  decision, dispute reason, status, amount and `settled_at`).
- New nullable column `jobs.employer_ref` (+ index), added to existing databases by the new
  `ADDITIVE_COLUMNS` step in `init_db` via `ALTER TABLE … ADD COLUMN`. Existing rows are kept.

### Files added / changed in Phase 3
- Added: `app/api/v1/completion.py`, `app/schemas/completion.py`,
  `app/services/{actors,execution,settlements,passbook}.py`,
  `tests/test_{execution,completion_review,settlement,passbook}.py`.
- Changed: `app/models.py` (5 models + `Job.employer_ref`), `app/db.py` (additive column step),
  `app/init_db.py` + `app/main.py` (report schema additions), `app/schemas/common.py` (statuses,
  `ReviewDecision`, `SettlementStatus`), `app/services/lifecycle.py` (transitions,
  `apply_transition`, `BOOKED_STATUSES`), `app/schemas/jobs.py` + `app/services/jobs.py`
  (`employer_id`), `app/schemas/marketplace.py` + `app/services/bookings.py` (optional
  `employer_id` at booking; already-booked check covers all post-booking states),
  `app/api/v1/{__init__,workers}.py` (routers, passbook route), `tests/conftest.py` (fixtures),
  `tests/test_schema_upgrade.py` (expected table list extended to Phase 3; two upgrade tests added).
- `frontend/`: unchanged.

### Tests and checks actually executed (2026-10-16)

| Check | Result |
|---|---|
| Baseline before any change | `pytest`: 165 passed; `ruff`: clean |
| `python -m pytest` after Phase 3 | **233 passed** — Phases 1–2: 165 (unchanged except the extended upgrade-test table list); Phase 3: test_execution 22, test_completion_review 23, test_settlement 14, test_passbook 7, 2 new upgrade tests (68) |
| Concurrency tests (booking race, booking stale read, settlement race) repeated 15× | 15/15 passed |
| `python -m ruff check .` | All checks passed |
| `python -m app.init_db` twice on a fresh scratch DB | All 12 tables created, then `none (schema already current)` |
| Documented PowerShell demo (EXECUTION_GUIDE) against `uvicorn` on a scratch DB | All 10 steps succeeded; settlement `simulated_settled 430 INR`; passbook completed=1, settled=430 |
| OpenAPI | 22 routes (15 existing + 7 new) |
| Search for payment-provider code/dependencies | None present |

The team's development database (`backend/var/laborlink.db`) was not opened or modified; it will
receive the Phase 3 tables and `jobs.employer_ref` the next time the server or `init_db` runs.

### Known limitations (Phase 3)
- **No authentication** — `worker_id`/`employer_id` are self-asserted; anyone with the ids can act.
- **Settlements are simulated** — no payment gateway, escrow, bank, wallet or lender integration.
- Disputes are terminal: no resolution, re-submission or cancellation flow.
- Evidence cannot be replaced once submitted; photos are not analysed and prove nothing about
  quality.
- Jobs created before Phase 3 (or without `employer_id`) need `employer_id` at booking time;
  already-booked legacy jobs without an employer cannot be confirmed (no endpoint sets it later).
- Passbook is single-currency (INR in the demo) and computed per request (fine at demo scale).
- Schema upgrades are additive only; Alembic is still needed for non-additive changes.

### Intentionally not implemented
Real payments/escrow/banking, identity verification, dispute resolution, ratings, notifications,
credit scoring or loan eligibility from the passbook.
