# Execution Guide

This document outlines how project changes are run, tested, and validated locally across components.

---

## 1. Environment & Setup

### Python Virtual Environment
- The project is equipped with a virtual environment configured in `.venv`.
- **Automatic Activation**: Opening a terminal in this workspace will automatically activate `.venv`.
- **Manual Activation (if required)**:
  - **PowerShell (Windows)**:
    ```powershell
    .venv\Scripts\Activate.ps1
    ```
  - **Command Prompt (cmd)**:
    ```cmd
    .venv\Scripts\activate.bat
    ```
  - **Bash / Git Bash**:
    ```bash
    source .venv/Scripts/activate
    ```

---

## 2. Backend Execution Workflow

### Prerequisites
- Python 3.10+ (the project `.venv` uses 3.10.9).
- No database server is needed: the backend uses a local SQLite file.
- Internet access only for `pip install` (and only if you enable the optional Anthropic provider).

### Steps (run from the repository root, `.venv` activated)
1. Navigate to the backend directory:
   ```powershell
   cd backend
   ```
2. Install dependencies:
   ```powershell
   python -m pip install -r requirements.txt
   ```
3. (Optional) Configure the environment — defaults work without a `.env` file:
   ```powershell
   Copy-Item .env.example .env
   ```
4. Initialise the database (also done automatically on server start):
   ```powershell
   python -m app.init_db
   ```
   Creates `backend/var/laborlink.db` and `backend/var/uploads/` (both git-ignored) and prints
   the schema additions it made (`Schema additions: …`).

   **Upgrading an existing Phase 1 or Phase 2 database:** run the same command (or just start
   the server). It only adds what is missing — Phase 2 tables (`workers`, `offers`, `bookings`),
   Phase 3 tables (`job_executions`, `completion_evidence`, `completion_evidence_images`,
   `completion_reviews`, `settlements`) and the nullable column `jobs.employer_ref` (added with
   `ALTER TABLE … ADD COLUMN`; existing rows keep their data and get `NULL`). Nothing is dropped
   or rewritten. Running it again prints `Schema additions: none (schema already current)`.
   Back up `backend/var/laborlink.db` first if its data matters to you. Jobs created before
   Phase 3 have no employer recorded: pass `employer_id` when booking them, or they cannot be
   confirmed/settled.
5. Start the development server:
   ```powershell
   python -m uvicorn app.main:app --reload
   ```
   - API: http://127.0.0.1:8000/api/v1/health
   - OpenAPI / Swagger UI: http://127.0.0.1:8000/docs (ReDoc: `/redoc`)
6. Run tests and lint:
   ```powershell
   python -m pytest
   python -m ruff check .
   ```
   Tests use a temporary database per test, ignore `backend/.env`, and never call paid APIs.

### Quick manual check
```powershell
curl.exe -X POST http://127.0.0.1:8000/api/v1/jobs -H "content-type: application/json" -d "{\"description\":\"Kitchen tap leaking\",\"location\":{\"address\":\"Ahmedabad\"}}"
```

### Phase 2 configuration

No new environment variables. Offer limits live in the rate card
(`LABORLINK_RATE_CARD_PATH`, default `app/data/rate_card.json`):

```json
"offer_limits": {"floor_ratio": 1.0, "ceiling_ratio": 1.25}
```

Workers may offer between `labour.min × floor_ratio` and `labour.max × ceiling_ratio` of the job's
current estimate. `floor_ratio` must be in (0, 1] and `ceiling_ratio` in [1, 3]; the app refuses to
start with invalid values. These are illustrative platform limits, not legal wage rules.

### End-to-end demo (Phases 1–3)

Start the server (step 5 above), then run the ten steps. The easiest way is the Swagger UI at
`/docs`; the request bodies are:

| # | Step | Request |
|---|---|---|
| 1 | Create a job | `POST /api/v1/jobs` `{"description": "Bathroom tap is leaking and dripping", "employer_id": "employer-anita", "location": {"address": "Navrangpura, Ahmedabad", "latitude": 23.0365, "longitude": 72.5611}}` |
| 2 | Create a worker | `POST /api/v1/workers` `{"display_name": "Ramesh Patel", "trades": ["plumber"], "years_experience": 8, "location": {"latitude": 23.0225, "longitude": 72.5714}}` |
| 3 | Find matches | `GET /api/v1/jobs/{job_id}/matches` (worker side: `GET /api/v1/workers/{worker_id}/jobs`) |
| 4 | Submit an offer | `POST /api/v1/jobs/{job_id}/offers` `{"worker_id": "{worker_id}", "kind": "accept_suggested"}` |
| 5 | Confirm the booking | `POST /api/v1/jobs/{job_id}/bookings` `{"offer_id": "{offer_id}"}` |
| 6 | Start the job | `POST /api/v1/jobs/{job_id}/start` `{"worker_id": "{worker_id}"}` |
| 7 | Submit evidence | upload photos with `POST /api/v1/images` (multipart field `file`), then `POST /api/v1/jobs/{job_id}/completion-evidence` `{"worker_id": "{worker_id}", "before_image_ids": ["{image_id}"], "after_image_ids": ["{image_id}"], "note": "Replaced the washer."}` |
| 8 | Confirm completion | `POST /api/v1/jobs/{job_id}/completion-confirmation` `{"employer_id": "employer-anita", "decision": "confirm"}` → settlement `simulated_pending` |
| 9 | Simulated settlement | `POST /api/v1/jobs/{job_id}/settlement` `{"employer_id": "employer-anita"}` → `simulated_settled` |
| 10 | Kamai Passbook | `GET /api/v1/workers/{worker_id}/passbook` |

To show a dispute instead of step 8, send
`{"employer_id": "employer-anita", "decision": "dispute", "dispute_reason": "Tap still leaks"}`;
step 9 then returns `409 job_disputed` and the passbook lists the job as `disputed`.

The same flow as a Windows PowerShell script (works in PowerShell 5.1; needs any JPEG/PNG/WebP
file for the photo step). Save it as `demo.ps1` and run
`.\demo.ps1 -Photo C:\path\to\photo.jpg` while the server is running:

```powershell
param([string]$Api = "http://127.0.0.1:8000/api/v1", [string]$Photo = "photo.jpg")
$ErrorActionPreference = "Stop"
function Post($path, $body) {
    Invoke-RestMethod -Method Post -Uri "$Api$path" -ContentType "application/json" `
        -Body ($body | ConvertTo-Json -Depth 5)
}

# 1. Create a job (with an employer label)
$job = Post "/jobs" @{
    description = "Bathroom tap is leaking and dripping"
    employer_id = "employer-anita"
    location    = @{ address = "Navrangpura, Ahmedabad"; latitude = 23.0365; longitude = 72.5611 }
}
# 2. Create a worker profile
$worker = Post "/workers" @{
    display_name = "Ramesh Patel"; trades = @("plumber"); years_experience = 8
    location = @{ latitude = 23.0225; longitude = 72.5714 }
}
# 3. Find matching workers
$matches = Invoke-RestMethod "$Api/jobs/$($job.id)/matches"
# 4. Submit an offer (accept the suggested amount)
$offer = Post "/jobs/$($job.id)/offers" @{ worker_id = $worker.id; kind = "accept_suggested" }
# 5. Confirm the booking
$booking = Post "/jobs/$($job.id)/bookings" @{ offer_id = $offer.id }
# 6. Start the job
$start = Post "/jobs/$($job.id)/start" @{ worker_id = $worker.id }
# 7. Upload before/after photos and submit completion evidence
$before = curl.exe -s -F "file=@$Photo" "$Api/images" | ConvertFrom-Json
$after  = curl.exe -s -F "file=@$Photo" "$Api/images" | ConvertFrom-Json
$evidence = Post "/jobs/$($job.id)/completion-evidence" @{
    worker_id = $worker.id; before_image_ids = @($before.id); after_image_ids = @($after.id)
    note = "Replaced the washer and resealed the joint."
}
# 8. Employer confirms completion (creates a simulated_pending settlement)
$review = Post "/jobs/$($job.id)/completion-confirmation" @{
    employer_id = "employer-anita"; decision = "confirm"
}
# 9. Record the simulated settlement
$settlement = Post "/jobs/$($job.id)/settlement" @{ employer_id = "employer-anita" }
# 10. Kamai Passbook
$passbook = Invoke-RestMethod "$Api/workers/$($worker.id)/passbook"

"matches: $($matches.candidates.Count)  offer: $($offer.labour_amount) $($offer.currency)"
"booking total: $($booking.agreed_total_amount)  job after start: $($start.job_status)"
"evidence: $($evidence.job_status)  review: $($review.decision) / $($review.settlement.status)"
"settlement: $($settlement.status) $($settlement.amount) $($settlement.currency)"
"passbook: completed=$($passbook.summary.completed_jobs) settled=$($passbook.summary.simulated_settled_earnings)"
```

Expected output (amounts come from the illustrative rate card):

```
matches: 1  offer: 380 INR
booking total: 430  job after start: in_progress
evidence: awaiting_confirmation  review: confirmed / simulated_pending
settlement: simulated_settled 430 INR
passbook: completed=1 settled=430
```

No money moves at any point: settlements are simulated records.

### Environment variables

All are optional. Set them in `backend/.env` (git-ignored) or the shell. See `backend/.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `LABORLINK_ENVIRONMENT` | `development` | `development` \| `test` \| `production` (informational) |
| `LABORLINK_DATABASE_URL` | `sqlite:///./var/laborlink.db` | SQLAlchemy URL; relative SQLite paths resolve against `backend/` |
| `LABORLINK_UPLOAD_DIR` | `./var/uploads` | Photo storage folder (relative to `backend/`) |
| `LABORLINK_MAX_UPLOAD_BYTES` | `5242880` | Max photo size (bytes) |
| `LABORLINK_RATE_CARD_PATH` | `./app/data/rate_card.json` | FairRate configuration |
| `LABORLINK_CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed origins |
| `LABORLINK_WORK_ORDER_PROVIDER` | `rule_based` | `rule_based` or `anthropic` |
| `LABORLINK_ANTHROPIC_MODEL` | `claude-opus-5-5` | Model used by the `anthropic` provider |
| `LABORLINK_ANTHROPIC_EFFORT` | `low` | `low` … `max` |
| `LABORLINK_PROVIDER_TIMEOUT_SECONDS` | `30` | Model request timeout |
| `ANTHROPIC_API_KEY` | — | Read by the Anthropic SDK only when the `anthropic` provider is enabled. Never commit it. |

### Common setup issues
- **`ModuleNotFoundError: No module named 'app'`** — run commands from inside `backend/`.
- **`ModuleNotFoundError: fastapi`** — the `.venv` is not active; activate it or call
  `..\.venv\Scripts\python.exe` directly.
- **Startup fails with `RateCardError`** — `LABORLINK_RATE_CARD_PATH` points to a missing or
  invalid file; the app refuses to start rather than price with bad configuration.
- **Port 8000 in use** — add `--port 8001` to the uvicorn command.
- **Reset local data** — stop the server and delete `backend/var/`; it is recreated on start.
  This deletes all jobs, workers, offers and bookings.
- **`409 job_already_booked` / `job_not_open` while testing** — the job was already booked;
  create a new job to try another booking flow.
- **`409 employer_not_recorded`** — the job was created without `employer_id` (e.g. before
  Phase 3). Pass `employer_id` when confirming the booking, or create a new job with it.
- **`403 actor_mismatch`** — the `worker_id`/`employer_id` sent is not the booked worker or the
  job's employer. These are demo labels, not logins.
- **`curl.exe` not found in PowerShell** — Windows 10+ ships `curl.exe`; on older systems use the
  Swagger UI for the photo upload.
- **`anthropic` provider configured but jobs show `fallback_used: true`** — credentials or network
  are unavailable; check the server log for the reason code (e.g. `api_error_401`, `timeout`).
  Jobs still succeed using the rule-based generator.

---

## 3. Frontend Execution Workflow

> The `frontend/` directory does not contain an application yet; the steps below apply once one is added.

1. Navigate to the frontend directory:
   ```powershell
   cd frontend
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Run development server:
   ```powershell
   npm run dev
   ```

---

## 4. Submitting & Documenting Changes

Before pushing changes to GitHub or opening a Pull Request:
1. Ensure your code passes all linting and test suites.
2. Add a new entry to [`docs/CHANGELOG.md`](./CHANGELOG.md) specifying:
   - Your name and date.
   - What was modified.
   - Exact steps required for reviewers to execute and verify your change.
3. If new dependencies were added, update `requirements.txt` (backend) or `package.json` (frontend).
