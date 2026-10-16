# Backend Architecture (Phases 1–3)

A single FastAPI application with a SQLite database. Business rules live in `app/services/` and
are plain Python, so they are tested without HTTP.

## Module layout

```
backend/
├── app/
│   ├── main.py                 # create_app(): settings, DB engine, rate card, provider, routes
│   ├── config.py               # Settings (env vars prefixed LABORLINK_, optional backend/.env)
│   ├── db.py                   # engine/session factory, UTC datetime type, init_db, DB check
│   ├── init_db.py              # `python -m app.init_db`
│   ├── models.py               # ORM: Job, WorkOrderRecord, PriceEstimateRecord, ImageUpload,
│   │                           #      Worker, Offer, Booking (Phase 2), JobExecution,
│   │                           #      CompletionEvidence(+Image), CompletionReview,
│   │                           #      Settlement (Phase 3)
│   ├── errors.py               # AppError hierarchy + handlers → {"error": {...}} envelope
│   ├── data/rate_card.json     # FairRate configuration (illustrative rates)
│   ├── schemas/                # Pydantic: common enums, jobs, work_order (v1), pricing,
│   │                           #           workers, marketplace (matching/offers/bookings),
│   │                           #           completion (evidence/review/settlement/passbook)
│   ├── api/
│   │   ├── deps.py             # dependencies reading shared objects from app.state
│   │   └── v1/                 # health, jobs, images, workers, marketplace, completion
│   └── services/
│       ├── jobs.py             # create / get / recalculate; transaction boundaries
│       ├── pricing.py          # FairRate formula + rate-card loader
│       ├── images.py           # validated photo storage
│       ├── db_guard.py         # SQLAlchemy errors → 503 (or a domain error for constraints)
│       ├── lifecycle.py        # job statuses, allowed transitions, require_open()
│       ├── workers.py          # worker profile create / get / update
│       ├── matching.py         # haversine, eligibility, transparent score, ranking
│       ├── discovery.py        # open jobs for a worker
│       ├── offers.py           # offer terms, validation, listings
│       ├── bookings.py         # transactional booking confirmation
│       ├── actors.py           # prototype worker/employer checks (not authentication)
│       ├── execution.py        # start job, completion evidence
│       ├── settlements.py      # employer review + simulated settlement ledger
│       ├── passbook.py         # Kamai Passbook computed from persisted records
│       └── work_orders/
│           ├── __init__.py     # WorkOrderService: provider → validate → fallback → gaps
│           ├── base.py         # WorkOrderInput, ProviderError, WorkOrderProvider protocol
│           ├── rule_based.py   # deterministic keyword provider (default + fallback)
│           ├── trade_rules.py  # keyword/problem tables for the four trades
│           └── anthropic_provider.py  # optional Claude vision provider
└── tests/                      # pytest suite (isolated temp DB per test)
```

## Job creation flow (`POST /api/v1/jobs`)

1. **Validate** the request (`JobCreate`): description 3–2000 chars, optional trade/urgency/
   language, location with an address and/or a lat/lng pair, optional `image_id`. Unknown fields
   are rejected.
2. **Resolve the image** (if any) — an unknown `image_id` returns 422 `invalid_reference`.
3. **Generate the work order** via `WorkOrderService`:
   - call the configured provider;
   - re-validate its output against `WorkOrderV1`;
   - on `ProviderError` (timeout, connection, API status, refusal, truncation, invalid output) or
     any unexpected exception, log the reason code and use the rule-based provider instead,
     recording `generator.fallback_used=true` and `fallback_reason`;
   - add intake-level gaps (no photo, no coordinates, very short description).
   This happens **before** any database write, so a provider failure cannot leave a partial job.
4. **Price it** with FairRate if a trade is known → status `estimated`; otherwise no estimate and
   status `needs_information`.
5. **Persist** job + work order + estimate in one transaction. Any SQLAlchemy error rolls back and
   returns 503 `database_unavailable`; a 201 is only returned after a successful commit.

`POST /jobs/{id}/price-estimate` re-reads the stored work order and urgency, prices them with the
**current** rate card and appends a new `price_estimates` row (history is kept; the newest row is
the job's current estimate).

## Work-order generation

| Provider | When | Image handling |
|---|---|---|
| `rule_based` | Default (`LABORLINK_WORK_ORDER_PROVIDER=rule_based`) and automatic fallback | Never inspects photos; reports `image_assessment.status="not_analysed"` with a disclaimer |
| `anthropic` | `LABORLINK_WORK_ORDER_PROVIDER=anthropic` + SDK credentials (e.g. `ANTHROPIC_API_KEY`) | Sends the photo; observations are labelled automated and unverified |

The rule-based provider scores whole-word keyword matches per trade (including some Hindi/Hinglish
words), picks the best-matching problem rule, and lowers confidence or adds follow-up questions on
ties, unknown trades, generic problems, or when the employer's chosen trade conflicts with the
description. The employer's chosen trade is always kept.

The Anthropic provider uses the official SDK (`messages.parse` with a Pydantic output schema,
model `claude-opus-5-5` and effort `low` by default, configurable), a client timeout and one retry.
Credentials are read by the SDK from the environment and never stored, logged or returned.
**It has only been tested with a mocked client; real image understanding has not been verified.**

## FairRate pricing

```
hourly_rate      = rate_card.trades[trade].hourly_rate   (raised to wage_floors[trade] if configured)
multiplier       = complexity_multipliers[complexity] × urgency_multipliers[urgency]
labour min / max = max(hourly_rate × duration min / max × multiplier, minimum_charge)
total  min / max = labour rounded down / up to rounding_step + travel_allowance
```

- All figures come from `app/data/rate_card.json` (path configurable). The shipped card is
  **illustrative** and says so in every estimate.
- `wage_floors` is empty by default. Only verified, jurisdiction-specific hourly figures should be
  added, together with `wage_floor_source`. Without them, every estimate reports
  `wage_floor_check.status = "not_configured"` and a warning.
- Materials are excluded; travel is still a flat allowance (a distance-based component is
  deferred even though worker locations now exist).
- Pure function, deterministic for identical inputs; the rate card is validated at startup
  (missing trades, non-positive multipliers or unsourced wage floors stop the app from starting).

## Data model

| Table | Key columns | Notes |
|---|---|---|
| `jobs` | `id` (UUID4), `status`, `description`, `description_source`, `language`, `requested_trade`, `trade`, `urgency`, `address`, `latitude`, `longitude`, `image_id`, `created_at`, `updated_at` | Central record. Phase 2 added status values; Phase 3 added nullable `employer_ref` |
| `work_orders` | `job_id` (unique FK), `schema_version`, `provider`, `payload` (JSON) | Validated `WorkOrderV1` |
| `price_estimates` | `job_id` (FK), `sequence`, `rate_card_version`, `currency`, `min_amount`, `max_amount`, `payload` (JSON) | Append-only history |
| `image_uploads` | `id`, `stored_filename`, `original_filename` (sanitised), `content_type`, `size_bytes`, `sha256` | Binary stored on disk, not in the DB |
| `workers` *(P2)* | `id`, `display_name`, `trades` (JSON list), `years_experience`, `latitude`, `longitude`, `locality`, `service_radius_km`, `availability`, timestamps | CHECKs on coordinates, radius > 0, experience ≥ 0 |
| `offers` *(P2)* | `id`, `job_id` (FK), `worker_id` (FK), `price_estimate_id` (FK), `kind`, `labour_amount`, `travel_allowance`, `currency`, `message`, `status`, `closed_reason`, timestamps | CHECK amount > 0; partial UNIQUE index `(job_id, worker_id) WHERE status='pending'` |
| `bookings` *(P2)* | `id`, `job_id` (FK, **UNIQUE**), `offer_id` (FK, UNIQUE), `worker_id` (FK), `agreed_labour_amount`, `travel_allowance`, `currency`, `status`, timestamps | One booking per job, enforced by the database |
| `job_executions` *(P3)* | `job_id` (UNIQUE), `booking_id` (UNIQUE), `worker_id`, `started_at` | One start per job |
| `completion_evidence` *(P3)* | `job_id` (UNIQUE), `booking_id` (UNIQUE), `worker_id`, `note`, `submitted_at` | One immutable submission per job |
| `completion_evidence_images` *(P3)* | `evidence_id` (FK), `image_id` (FK → `image_uploads`), `role` (`before`/`after`, CHECK), `position` | UNIQUE (`evidence_id`, `image_id`); photos stay in the Phase 1 upload store |
| `completion_reviews` *(P3)* | `job_id` (UNIQUE), `booking_id` (UNIQUE), `evidence_id`, `employer_ref`, `decision` (CHECK), `dispute_reason` (CHECK: required when disputed), agreed amounts, `reviewed_at` | One final decision per job |
| `settlements` *(P3)* | `job_id`, `booking_id`, `review_id` (all UNIQUE), `worker_id`, `employer_ref`, `labour_amount`, `travel_allowance`, `amount` (CHECK > 0), `currency`, `status` (CHECK `simulated_pending`/`simulated_settled`), `created_at`, `settled_at` (CHECK: set iff settled) | Simulated ledger; never deleted |

Timestamps are stored as UTC and returned as timezone-aware ISO-8601 (`...Z`).

### Schema upgrades

`init_db` (run at startup and by `python -m app.init_db`, which prints what it added) upgrades
a database additively:

1. `create_all` creates **missing** tables and their indexes; it never drops or alters existing
   tables.
2. `ADDITIVE_COLUMNS` in `app/db.py` lists nullable columns added to tables from earlier phases.
   Each missing one is added with `ALTER TABLE … ADD COLUMN` (plus its index). SQLite adds such a
   column without rewriting the table, and every existing row keeps its values (`NULL` in the
   new column). Phase 3 uses this once: `jobs.employer_ref`.

Nothing is ever dropped, renamed or rewritten. Upgrades from a Phase 1-only and a Phase 2-shaped
database, including preservation of an existing job row, are covered by
`tests/test_schema_upgrade.py`. **Limitation:** this is not a migration framework — type changes,
renames or new NOT NULL columns would need Alembic; back up `backend/var/laborlink.db` before
upgrading data you care about.

## Job lifecycle

```
needs_information                    (trade unknown; not discoverable; recreate the job with a trade)
estimated ──recalculate──▶ estimated
estimated ──confirm booking──▶ booked
booked ──worker starts──▶ in_progress
in_progress ──worker submits evidence──▶ awaiting_confirmation
awaiting_confirmation ──employer confirms──▶ completed    (simulated settlement allowed)
awaiting_confirmation ──employer disputes──▶ disputed     (terminal; never settled)
```

- `estimated` is the **open** state: only these jobs appear in worker discovery, can be matched,
  receive offers and be booked (`lifecycle.require_open`).
- Transitions are listed in `lifecycle.ALLOWED_TRANSITIONS`; anything else raises
  `409 invalid_status_transition`. Recalculating a `booked` job is rejected (`409 job_not_open`)
  so the booking keeps the estimate it was agreed against.
- Phase 3 transitions go through `lifecycle.apply_transition`, a conditional
  `UPDATE jobs SET status=:new WHERE id=:id AND status=:expected` inside the caller's transaction,
  so a concurrent change is detected instead of overwritten.
- `completed` and `disputed` are terminal; dispute resolution is deliberately not implemented.
- Offer statuses: `pending → accepted | rejected` (`closed_reason: another_offer_booked`).
  The booking row stays `confirmed`; execution progress is tracked by the job status.

## Worker matching and discovery

`matching.assess(worker, job)` is a pure function used wherever eligibility matters (matching,
discovery, offer creation, booking):

1. the worker lists the job's trade;
2. the worker is `available`;
3. if the job has coordinates, haversine distance ≤ the worker's `service_radius_km`.
   Without job coordinates the distance is `null` — never invented — the radius rule is skipped,
   and an explicit limitation is returned (`distance_matching: "unavailable"`).

Score = distance points (≤ 60, `60 × (1 − d/radius)`) + experience points (≤ 40, capped at 10
self-reported years). Price is never part of the score. Sort key: score desc, distance asc
(unknown last), worker id — fully deterministic. Workers are scanned in Python, which is fine for
a demo-sized SQLite database; a geospatial index would be needed at real scale. No ratings are
used because no rating records exist yet.

Discovery (`GET /workers/{id}/jobs`) runs the same assessment from the worker's side over open
jobs of the worker's trades, hides the employer's address/coordinates, and attaches the job's
offer terms.

## Offers

- Terms come from `pricing.offer_terms(rate_card, current_estimate)`: the permitted labour range is
  `[labour.min × floor_ratio, labour.max × ceiling_ratio]` and the suggested amount is the
  midpoint. Ratios live in the rate card (`offer_limits`, default 1.0 / 1.25) and are presented as
  illustrative platform policy, not law. No second pricing formula exists.
- A job without a valid current estimate cannot receive offers (`409 estimate_unavailable`).
- One pending offer per worker per job: checked in code and enforced by a partial unique index
  (a concurrent duplicate maps to `409 duplicate_offer`).
- Offers store the estimate id, the labour amount and the estimate's travel allowance.

## Booking persistence

`bookings.confirm_booking` re-validates everything (offer belongs to job, job open, offer pending,
worker still eligible, amount within the *current* permitted range), then in **one transaction**:

1. `UPDATE jobs SET status='booked' WHERE id=:id AND status='estimated'` — if no row changes,
   another request booked first → `409 job_already_booked`;
2. insert the `bookings` row (`job_id` UNIQUE as a second guard);
3. mark the chosen offer `accepted`;
4. mark all other pending offers `rejected` with `closed_reason='another_offer_booked'`;
5. commit. Any database error rolls everything back (503) — tested with a failing commit.

A threaded test confirms that two simultaneous bookings for different offers produce exactly one
booking. No payment or escrow is involved (`payment: "not_handled"`).

## Completion, review and simulated settlement (Phase 3)

**Actors.** There is no authentication. `actors.py` compares the self-asserted `worker_id` with
the booking's worker (start, evidence) and `employer_id` with `jobs.employer_ref` (review,
settlement), returning `403 actor_mismatch`. `employer_ref` is set from `employer_id` on job
creation or, if still empty, on booking confirmation.

**Start** (`execution.start_job`): booking must exist → worker matches → transition
`booked → in_progress` and insert `job_executions` in one transaction.

**Evidence** (`execution.submit_evidence`): the job must be `in_progress`; all referenced image ids
must exist in `image_uploads` (photos are uploaded with the unchanged Phase 1 endpoint, so type,
size and storage rules are reused, not duplicated). Evidence row, image links and the transition
to `awaiting_confirmation` commit together. One immutable submission per job (UNIQUE `job_id`).

**Review** (`settlements.review_completion`): employer matches → job is `awaiting_confirmation`
(otherwise `completion_evidence_missing` or `completion_already_reviewed`). In one transaction:
transition to `completed`/`disputed`, insert `completion_reviews` (with the booking's agreed
amounts copied in) and — **only for a confirmation** — insert a `settlements` row with status
`simulated_pending` and `amount = booking.agreed_labour_amount + booking.travel_allowance`.

**Settlement** (`settlements.settle`): employer matches → job `completed` (disputed jobs are
refused) → settlement exists and still matches the booking → conditional
`UPDATE settlements SET status='simulated_settled', settled_at=now WHERE id=:id AND
status='simulated_pending'`. A repeated or concurrent request finds no pending row and gets
`409 already_settled` (a threaded test confirms exactly one success).

**Guarantees.** No client-supplied amounts (request schemas forbid extra fields); one review, one
settlement per booking (UNIQUE constraints); CHECK constraints on decision, status, amount and
`settled_at`; every multi-row change is a single transaction that rolls back fully on error
(tested by forcing commit failures). Settlement rows are never updated except
pending → settled and never deleted, so they form the audit record. **No money moves** — there is
no payment gateway, escrow, bank or wallet integration.

## Kamai Passbook data flow

`GET /workers/{id}/passbook` runs one query: the worker's `bookings` joined to `jobs`, outer-joined
to `completion_reviews` and `settlements`. Each booking becomes an entry classified as
`in_progress`, `confirmed_unsettled`, `settled` or `disputed`; the summary (completed jobs,
confirmed earnings, simulated settled earnings, pending settlements, disputed amounts, active jobs)
is summed from those entries on every request. No running totals are stored, so the passbook
cannot drift from the ledger or double-count on repeated calls. Disputed jobs are never counted as
earnings. It is a work/earnings history, not a bank statement or credit score.

## Image uploads

`POST /api/v1/images` (multipart field `file`): type detected from magic bytes (JPEG/PNG/WebP
only), size enforced while reading (`LABORLINK_MAX_UPLOAD_BYTES`, default 5 MB), stored as
`<uuid>.<ext>` in `LABORLINK_UPLOAD_DIR` (default `backend/var/uploads`, git-ignored). Files are
never executed and not served back in Phase 1. If the DB write fails the file is deleted.

## Errors

All errors use `{"error": {"code", "message", "details"}}`. Codes: `validation_error` (422),
`invalid_reference` (422), `not_found` (404), `trade_required` (409), `job_not_open` (409),
`job_already_booked` (409), `worker_not_eligible` (409), `duplicate_offer` (409),
`estimate_unavailable` (409), `offer_not_pending` (409), `invalid_status_transition` (409),
`offer_out_of_range` (422), `offer_job_mismatch` (422), `actor_mismatch` (403),
`employer_not_recorded` (409), `job_not_booked` (409), `job_not_started` (409),
`evidence_already_submitted` (409), `completion_evidence_missing` (409),
`completion_already_reviewed` (409), `completion_not_confirmed` (409), `job_disputed` (409),
`already_settled` (409), `settlement_inconsistent` (409), `payload_too_large` (413),
`unsupported_media_type` (415), `database_unavailable` (503), `storage_error` (500),
`internal_error` (500, no internal details). See [API.md](./API.md).

## Security boundary (development)

- **No authentication or authorisation.** The API is intended for local/demo use only. Anyone who
  can reach it can create or edit any worker profile, submit offers as any worker, and confirm a
  booking for any job. Production use requires accounts, per-role access control (the employer
  owns the job; the worker owns the profile and offers) and rate limiting. Do not expose it
  publicly as-is.
- Worker profiles are self-declared and marked `verification_status: "unverified"`; no identity
  documents are collected and no government APIs are called.
- Phase 3 `worker_id` / `employer_id` checks only keep the demo roles consistent; they are
  self-asserted labels that anyone can send, not identity verification.
- Settlements are simulated records; no payment, escrow, banking or lending integration exists.
- Privacy: match results and job discovery omit worker coordinates and the employer's address,
  but `GET /workers/{id}` returns the worker's stored coordinates to anyone with the id.
- No secrets in code or responses; `.env` is git-ignored; only `.env.example` is committed.
- CORS is restricted to `LABORLINK_CORS_ORIGINS` and to GET/POST/PATCH.
- No administrative or destructive endpoints exist; no payments are processed.
