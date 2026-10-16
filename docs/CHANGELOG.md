# Project Change Log

This file tracks all modifications, additions, and updates made across the project by team members.

---

## Log Format Template

When submitting changes, please append an entry following this format:

```markdown
### [YYYY-MM-DD] - <Short Summary of Feature / Fix>
- **Author**: <Your Name / GitHub Handle>
- **Component**: frontend | backend | docs
- **Type**: Feature | Bugfix | Refactor | Chore
- **Description**:
  - What problem was solved or what feature was added.
  - Important architectural decisions or technical notes.
- **Execution & Testing**:
  - Commands to execute and test the change (e.g., `pytest`, `npm test`, specific endpoints).
  - Prerequisites or migrations needed.
```

---

## Change History

### [2026-10-15] - Initial Project Setup
- **Author**: Initial Setup
- **Component**: Root (`frontend`, `backend`, `docs`)
- **Type**: Chore / Architecture
- **Description**:
  - Structured codebase into three core directories: `frontend`, `backend`, and `docs`.
  - Configured Python virtual environment (`.venv`) with automatic terminal activation.
  - Added `.gitignore` and `.gitkeep` for version control tracking.
- **Execution & Testing**:
  - Verified directory structure and virtual environment activation scripts.

### [2026-10-16] - Phase 1 backend: job intake, work orders, FairRate pricing
- **Author**: Claude Code (AI assistant)
- **Component**: backend | docs
- **Type**: Feature
- **Description**:
  - FastAPI backend in `backend/app` with SQLite persistence, `/api/v1` routes: health, image upload, create/get job, recalculate price estimate.
  - Versioned structured work order (`WorkOrderV1`) from a deterministic rule-based generator, with an optional Claude vision provider and automatic fallback on provider failure.
  - FairRate deterministic pricing from a configurable, explicitly illustrative rate card; wage-floor check reports `not_configured` instead of inventing legal figures.
  - Consistent error envelope; DB failures return 503 and never leave partial records.
  - Docs added: PROJECT_OVERVIEW, BACKEND_ARCHITECTURE, API, IMPLEMENTATION_PROGRESS; EXECUTION_GUIDE updated. `frontend/` untouched.
- **Execution & Testing**:
  - `cd backend`, `python -m pip install -r requirements.txt`, `python -m uvicorn app.main:app --reload`, open `/docs`.
  - `python -m pytest` (87 passed) and `python -m ruff check .` (clean).

### [2026-10-16] - Phase 2 backend: workers, matching, offers, booking
- **Author**: Claude Code (AI assistant)
- **Component**: backend | docs
- **Type**: Feature
- **Description**:
  - Worker profiles (`POST/GET/PATCH /api/v1/workers`), self-declared and marked unverified.
  - Matching (`GET /jobs/{id}/matches`): trade, availability, haversine distance vs service radius; transparent score from distance and experience, never price; explicit handling of jobs without coordinates.
  - Worker job discovery (`GET /workers/{id}/jobs`) without employer address.
  - Offers (`POST/GET /jobs/{id}/offers`, `GET /workers/{id}/offers`): accept suggested amount or counter within rate-card `offer_limits` applied to the current FairRate estimate; one pending offer per worker per job (DB-enforced).
  - Booking (`POST /jobs/{id}/bookings`, `GET /jobs/{id}/booking`): single transaction, conditional job update + UNIQUE(job_id) prevent double booking; competing offers closed.
  - Lifecycle: new `booked` status; recalculating a booked job now returns 409 `job_not_open`. CORS now allows PATCH.
  - Schema: new tables `workers`, `offers`, `bookings` only; existing databases upgrade in place via `python -m app.init_db` or startup.
  - Docs updated: API, BACKEND_ARCHITECTURE, IMPLEMENTATION_PROGRESS, PROJECT_OVERVIEW, EXECUTION_GUIDE. `frontend/` untouched. Phase 3 not started.
- **Execution & Testing**:
  - `cd backend`, `python -m app.init_db`, `python -m uvicorn app.main:app --reload`, follow the Phase 2 walkthrough in EXECUTION_GUIDE.
  - `python -m pytest` (165 passed: 87 Phase 1 unchanged + 78 Phase 2) and `python -m ruff check .` (clean).
