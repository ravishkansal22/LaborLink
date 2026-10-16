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
