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
   Creates `backend/var/laborlink.db` and `backend/var/uploads/` (both git-ignored).
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
