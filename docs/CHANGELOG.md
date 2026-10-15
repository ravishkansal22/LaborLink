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
