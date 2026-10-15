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

1. Navigate to the backend directory:
   ```powershell
   cd backend
   ```
2. Ensure dependencies are installed:
   ```powershell
   pip install -r requirements.txt
   ```
3. Run the development server (example for FastAPI / Flask / Django):
   ```powershell
   # Example: python main.py OR uvicorn main:app --reload
   ```
4. Run tests:
   ```powershell
   pytest
   ```

---

## 3. Frontend Execution Workflow

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
