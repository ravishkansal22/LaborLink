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
3. **Matching and booking.** Suitable workers nearby are matched to the job, make offers within
   fair limits, and the employer books one (Phase 2).
4. **Completion and Kamai Passbook.** The worker submits completion photos, the employer
   confirms or disputes, confirmed work receives a *simulated* settlement, and completed jobs and
   earnings appear in the worker's digital passbook (Phase 3).

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
| Frontend | Next.js 14 phone-style web app in `frontend/` (employer and worker apps, Leaflet/OpenStreetMap live tracking) |

## User flow (target product)

1. Employer photographs the problem and records/types a description.
2. LaborLink creates a work order and a FairRate estimate; the employer answers any follow-up
   questions. *(Phase 1 — implemented in the backend)*
3. Nearby workers see the job, accept the suggested amount or counter-offer within the
   permitted range; the employer compares offers and books one. *(Phase 2 — implemented in the
   backend)*
4. The worker starts the job, completes it and uploads before/after photos; the employer
   confirms (or disputes); confirmed work gets a simulated settlement and appears in the worker's
   Kamai Passbook. *(Phase 3 — implemented in the backend)*

## Full vision vs. hackathon prototype

The prototype implements steps 1–4 above as a FastAPI backend and a Next.js web app; voice input uses the browser's speech recognition.
Server-side speech recognition, real image understanding (unless an API key is configured), user accounts and
authentication, verified worker identities, ratings, notifications, dispute resolution, **real
payments or escrow**, and any lending or credit use of the passbook are part of the wider vision
but **not** of the current prototype. Settlements are simulated records only.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Backend foundation, job intake, structured work orders, FairRate price estimates, persistence | **Complete** (see [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md)) |
| **Phase 2** | Worker profiles, location-based matching, job discovery, counter-bidding and booking | **Complete** (see [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md)) |
| **Phase 3** | Job completion evidence, completion confirmation, simulated payment settlement, Kamai Passbook | **Complete** (see [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md)) |
