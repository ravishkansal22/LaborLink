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

### [2026-10-16] - Phase 3 backend: completion, simulated settlement, Kamai Passbook
- **Author**: Claude Code (AI assistant)
- **Component**: backend | docs
- **Type**: Feature
- **Description**:
  - Job execution: `POST /jobs/{id}/start` (booked worker only); lifecycle `booked -> in_progress -> awaiting_confirmation -> completed | disputed`, centralised in `services/lifecycle.py`.
  - Completion evidence: `POST/GET /jobs/{id}/completion-evidence` with before/after photos referencing existing `/images` uploads; one immutable submission per job.
  - Employer review: `POST /jobs/{id}/completion-confirmation` (confirm or dispute with reason); one final decision per job; disputes are never settled.
  - Simulated settlement: `POST/GET /jobs/{id}/settlement`; amount always taken from the booking; `simulated_pending -> simulated_settled` once; UNIQUE per booking. No real payments, escrow or banking.
  - Kamai Passbook: `GET /workers/{id}/passbook`, computed from persisted bookings, reviews and settlements.
  - Optional self-asserted `employer_id` on `POST /jobs` and `POST /jobs/{id}/bookings` (prototype actor check, not authentication).
  - Schema: new tables `job_executions`, `completion_evidence`, `completion_evidence_images`, `completion_reviews`, `settlements`; new nullable column `jobs.employer_ref` added in place by `init_db` (`ALTER TABLE ... ADD COLUMN`).
  - Docs updated: API, BACKEND_ARCHITECTURE, IMPLEMENTATION_PROGRESS, PROJECT_OVERVIEW, EXECUTION_GUIDE (10-step demo). `frontend/` untouched.
- **Execution & Testing**:
  - `cd backend`, `python -m app.init_db`, `python -m uvicorn app.main:app --reload`, then run the end-to-end demo in EXECUTION_GUIDE.
  - `python -m pytest` (233 passed: 165 Phases 1-2 + 68 Phase 3) and `python -m ruff check .` (clean).

### [2026-10-16] - Employer-reference review (no code change)
- **Author**: Claude Code (AI assistant)
- **Component**: backend tests | docs
- **Type**: Chore (verification + documentation)
- **Description**:
  - Verified that bookings record `employer_id` only when none exists, never overwrite a recorded employer (403 on mismatch), and that only the recorded employer can confirm, dispute or settle. No production code change was needed.
  - Documented the remaining limitation: jobs already booked without an employer (e.g. under Phase 2) cannot be confirmed/disputed/settled via the API; added a guarded manual operator path (`UPDATE ... WHERE employer_ref IS NULL`) and the future authenticated path.
  - Added `backend/tests/test_employer_reference.py` (9 regression tests, including a Phase 2-shaped database upgrade).
  - Docs updated: API, BACKEND_ARCHITECTURE, EXECUTION_GUIDE, IMPLEMENTATION_PROGRESS. `frontend/` untouched.
- **Execution & Testing**:
  - `cd backend`, `python -m pytest` (242 passed) and `python -m ruff check .` (clean).

### [2026-10-16] - Frontend connected to the backend
- **Author**: Claude Code (AI assistant)
- **Component**: frontend | backend | docs
- **Type**: Feature
- **Description**:
  - Frontend rebuilt on a typed API client; all screens use live API data (no sample content). New modules: `app/lib/{api,session,places}.ts`, `app/components/{ui,clock}.tsx`, `app/screens/{onboarding,employer,worker}.tsx`; `next.config.mjs` proxies `/api/v1` to the backend.
  - Employer and worker flows cover job intake (photo + speech-to-text), estimates, matches, offers, booking, start, completion photos, confirm/dispute, demo payment and the Kamai Passbook.
  - Backend: new `GET /api/v1/images/{image_id}` (+2 tests); pricing assumption text no longer mentions Phase 2.
  - `.gitignore`: the Python `lib/` rule no longer hides `frontend/app/lib/` (it would have left the API client out of commits).
  - Docs: API, BACKEND_ARCHITECTURE, EXECUTION_GUIDE (how to run both apps and demo the flow), IMPLEMENTATION_PROGRESS.
- **Execution & Testing**:
  - Backend: `cd backend`, `python -m uvicorn app.main:app --reload`; `python -m pytest` (244 passed), `python -m ruff check .`.
  - Frontend: `cd frontend`, `npm run dev`, open http://localhost:3000; `npx tsc --noEmit`, `npx eslint app`.

### [2026-10-17] - Workers see the employer's photo before offering
- **Author**: Claude Code (AI assistant)
- **Component**: backend | frontend | docs
- **Type**: Feature
- **Description**:
  - `GET /api/v1/workers/{id}/jobs` items now include `description` (the employer's words) and
    `image_id` (their photo of the fault). The address is still hidden.
  - Worker app: a photo thumbnail in the job lists. The job-details screen shows "What the
    customer said" and the full photo. The photo was already visible after booking.
- **Execution & Testing**:
  - `python -m pytest` (296 passed, 1 new test), `ruff`, `tsc` and `eslint` are clean.
  - Live check: an uploaded photo appeared in the worker's Find work list and on the job details.

### [2026-10-17] - Multilingual app (11 languages), live dictation, map load fix
- **Author**: Claude Code (AI assistant)
- **Component**: backend | frontend | docs
- **Type**: Feature + Bug fix
- **Description**:
  - Multilingual:
    - The app is available in English, Hindi, Bengali, Marathi, Gujarati, Punjabi, Tamil,
      Telugu, Kannada, Malayalam and Odia. Pick one on the first screen or in Profile.
    - New `POST /api/v1/translate` endpoint (Sarvam AI `mayura:v1`, `formal` mode), with a
      `translations` cache table.
    - Frontend `t()` / `tx()` (`lib/i18n.ts`) batch the missing strings and keep them in
      localStorage. Hand-checked Hindi overrides are in `lib/overrides.ts`. Dates are localised
      with `Intl`.
  - Job descriptions in an Indian script are translated to English for the work-order engine.
    The original text is stored and shown.
  - Dictation:
    - **Speak** now uses the browser's recognizer first, with interim results, so words appear
      live as you speak in the app language. It's free and saves Sarvam credits.
    - Sarvam speech-to-text is the fallback for browsers without a recognizer.
    - Speech now supports all 11 languages.
  - Fix: the Leaflet chunk load is retried once, and then a "Reload map" button is shown
    instead of crashing the screen. The `ChunkLoadError` came from a stale `.next` dev cache.
- **Execution & Testing**:
  - `python -m pytest`: 295 passed. `ruff`, `npx tsc --noEmit` and `npx eslint app` are clean.
  - Live checks with a real key:
    - The welcome screen in Tamil, and the new-job screen and job page in Hindi.
    - A Devanagari description was priced as plumbing work, with its Hindi title kept.
    - A 24-string screen in a new language translated in about 2.4 s.

### [2026-10-17] - Job titles from the employer's words; Sarvam AI speech-to-text
- **Author**: Claude Code (AI assistant)
- **Component**: backend | frontend | docs
- **Type**: Bug fix + Feature
- **Description**:
  - Fix: the rule-based work order used a fixed category label as the job title (for example "General electrical inspection and repair"), so the title never matched what was typed. `problem_summary` is now the employer's own first sentence (max 120 characters); the category stays in `problem_category`.
  - Fix: keyword matching accepts simple plurals ("lights", "shelves", "tiles"). Added keywords and a "fan, light or regulator" electrician category. A selected trade with no matching words in the description now raises a follow-up question.
  - Feature: `GET /api/v1/speech/status` and `POST /api/v1/speech/transcribe` (Sarvam AI). New settings `SARVAM_API_KEY`, `LABORLINK_SARVAM_STT_MODEL`, `LABORLINK_MAX_AUDIO_BYTES`. `httpx` moved to runtime requirements.
  - Frontend: the **Speak** button records audio (up to 25 s) and sends it to the backend when Sarvam is available; otherwise it uses browser speech recognition.
- **Execution & Testing**:
  - `python -m pytest` (280 passed), `python -m ruff check .`; `npx tsc --noEmit`, `npx eslint app`.
  - Live: a real WAV and a browser WebM/Opus recording were transcribed through the endpoint; a typed job showed the typed text as its title.

### [2026-10-16] - Ride-style trip tracking
- **Author**: Claude Code (AI assistant)
- **Component**: frontend | docs
- **Type**: Feature
- **Description**:
  - New full-screen tracking screens:
    - Employer: a moving arrow on the road route, a bottom sheet with “Arriving in N min”, a journey
      bar and the worker card.
    - Worker: a trip screen with automatic GPS sharing or a demo trip, Google Maps navigation and
      swipe-to-start.
  - New “on the way” banner on the employer's home and job pages.
  - Tracking opens automatically after booking.
  - Road routes come from the public OSRM server, with a straight-line fallback.
  - Replaced the old in-page tracking/share cards.
  - `next.config.mjs` gains an optional `NEXT_DIST_DIR`.
  - No backend changes.
- **Execution & Testing**:
  - `npx tsc --noEmit`, `npx eslint app`.
  - Manual two-tab run against a scratch backend.

### [2026-10-16] - Live worker location on a map
- **Author**: Claude Code (AI assistant)
- **Component**: backend | frontend | docs
- **Type**: Feature
- **Description**:
  - Backend: `worker_locations` table and `POST`/`GET /api/v1/jobs/{job_id}/worker-location` (booked worker shares; job's employer views distance and approximate ETA). 15 new tests.
  - Frontend: Leaflet/OpenStreetMap live map (`app/components/live-map.tsx`); worker can share GPS or run a labelled demo trip; employer sees the worker moving, ETA and a Google Maps route link. New dependency: `leaflet` 1.9.4 (+ `@types/leaflet`).
  - Docs: API, BACKEND_ARCHITECTURE, EXECUTION_GUIDE, IMPLEMENTATION_PROGRESS.
- **Execution & Testing**:
  - `python -m pytest` (259 passed), `python -m ruff check .`; frontend `npx tsc --noEmit`, `npx eslint app`.
