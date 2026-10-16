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
