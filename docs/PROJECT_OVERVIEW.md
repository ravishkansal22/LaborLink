# LaborLink — Project Overview

## Problem

Daily-wage skilled workers (plumbers, electricians, masons, carpenters) mostly find work through
labour chowks, middlemen and word of mouth. Employers struggle to describe the job precisely, have
no reference for a fair price, and cannot easily find a suitable worker nearby. Workers face
unpredictable income, price haggling without reference points and no verifiable record of the
work they have done — which also keeps them out of formal credit and benefits.

## Solution

LaborLink connects employers with nearby skilled workers and makes each job transparent:

1. **Job intake → structured work order.** The employer submits a photo and a spoken or written
   description; LaborLink turns it into a structured work order (trade, problem, tools, materials,
   duration, open questions).
2. **FairRate.** An indicative, explainable price range with every assumption stated.
3. **Matching.** Suitable workers nearby are matched to the job (Phase 2).
4. **Kamai Passbook.** Completed jobs and earnings are recorded as a digital passbook for the
   worker (Phase 3).

## Intended users

- **Employers** — households and small businesses who need a skilled worker for a specific job.
- **Workers** — daily-wage tradespeople looking for nearby work at a fair rate and a record of
  their earnings.

## Key features and USPs

- Photo + voice/text intake designed for low-literacy, multilingual use (Hindi/Hinglish keywords
  are understood by the rule-based generator).
- Explainable pricing: every estimate lists its rate source, multipliers, assumptions and
  warnings; illustrative rates are never presented as official market rates or legal wages.
- Honest uncertainty: missing information and follow-up questions are surfaced instead of guessed;
  photo-based observations are never presented as confirmed facts.
- Earnings passbook as a path to financial inclusion (planned).

## Technical stack (current)

| Layer | Choice |
|---|---|
| Backend | Python 3.10, FastAPI, Pydantic v2, SQLAlchemy 2.0 |
| Database | SQLite (local file) |
| Work-order generation | Deterministic rule-based provider (default); optional Claude vision-language provider via configuration |
| Tests / quality | pytest, ruff |
| Frontend | `frontend/` — not yet implemented in this repository |

## User flow (target product)

1. Employer photographs the problem and records/types a description.
2. LaborLink creates a work order and a FairRate estimate; the employer answers any follow-up
   questions. *(Phase 1 — implemented in the backend)*
3. Nearby workers see the job, accept or counter-bid; the employer books one. *(Phase 2)*
4. The worker completes the job and uploads evidence; the employer confirms; payment is
   (simulated) settled and the job is added to the worker's Kamai Passbook. *(Phase 3)*

## Full vision vs. hackathon prototype

The prototype implements step 2 above as a backend API. Speech recognition, real image
understanding (unless an API key is configured), worker accounts, matching, bookings, payments and
the passbook are part of the vision but **not** of the current prototype.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Backend foundation, job intake, structured work orders, FairRate price estimates, persistence | **Complete** (see [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md)) |
| **Phase 2** | Worker profiles, location-based matching, job discovery, counter-bidding and booking | Pending |
| **Phase 3** | Job completion evidence, completion confirmation, simulated payment settlement, Kamai Passbook | Pending |
