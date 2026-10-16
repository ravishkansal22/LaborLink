# Backend Architecture (Phases 1–2)

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
│   │                           #      Worker, Offer, Booking (Phase 2)
│   ├── errors.py               # AppError hierarchy + handlers → {"error": {...}} envelope
│   ├── data/rate_card.json     # FairRate configuration (illustrative rates)
│   ├── schemas/                # Pydantic: common enums, jobs, work_order (v1), pricing,
│   │                           #           workers, marketplace (matching/offers/bookings)
│   ├── api/
│   │   ├── deps.py             # dependencies reading shared objects from app.state
│   │   └── v1/                 # health, jobs, images, workers, marketplace (at /api/v1)
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
| `jobs` | `id` (UUID4), `status`, `description`, `description_source`, `language`, `requested_trade`, `trade`, `urgency`, `address`, `latitude`, `longitude`, `image_id`, `created_at`, `updated_at` | Central record; unchanged in Phase 2 (only new status values) |
| `work_orders` | `job_id` (unique FK), `schema_version`, `provider`, `payload` (JSON) | Validated `WorkOrderV1` |
| `price_estimates` | `job_id` (FK), `sequence`, `rate_card_version`, `currency`, `min_amount`, `max_amount`, `payload` (JSON) | Append-only history |
| `image_uploads` | `id`, `stored_filename`, `original_filename` (sanitised), `content_type`, `size_bytes`, `sha256` | Binary stored on disk, not in the DB |
| `workers` *(P2)* | `id`, `display_name`, `trades` (JSON list), `years_experience`, `latitude`, `longitude`, `locality`, `service_radius_km`, `availability`, timestamps | CHECKs on coordinates, radius > 0, experience ≥ 0 |
| `offers` *(P2)* | `id`, `job_id` (FK), `worker_id` (FK), `price_estimate_id` (FK), `kind`, `labour_amount`, `travel_allowance`, `currency`, `message`, `status`, `closed_reason`, timestamps | CHECK amount > 0; partial UNIQUE index `(job_id, worker_id) WHERE status='pending'` |
| `bookings` *(P2)* | `id`, `job_id` (FK, **UNIQUE**), `offer_id` (FK, UNIQUE), `worker_id` (FK), `agreed_labour_amount`, `travel_allowance`, `currency`, `status`, timestamps | One booking per job, enforced by the database |

Timestamps are stored as UTC and returned as timezone-aware ISO-8601 (`...Z`).

### Schema upgrades

Tables are created with `create_all` at startup and via `python -m app.init_db`, which prints the
tables it created. `create_all` only creates **missing** tables and indexes; it never drops or
alters existing ones. Phase 2 was deliberately additive (three new tables, no change to Phase 1
columns), so an existing Phase 1 database is upgraded in place with its data intact — covered by
`tests/test_schema_upgrade.py`. The first change to an *existing* table will need a real
migration tool (Alembic) instead.

## Job lifecycle

```
needs_information                    (trade unknown; not discoverable; recreate the job with a trade)
estimated ──recalculate──▶ estimated
estimated ──confirm booking──▶ booked
booked ──▶ in_progress / completed   (Phase 3, not implemented)
```

- `estimated` is the **open** state: only these jobs appear in worker discovery, can be matched,
  receive offers and be booked (`lifecycle.require_open`).
- Transitions are listed in `lifecycle.ALLOWED_TRANSITIONS`; anything else raises
  `409 invalid_status_transition`. Recalculating a `booked` job is rejected (`409 job_not_open`)
  so the booking keeps the estimate it was agreed against.
- Offer statuses: `pending → accepted | rejected` (`closed_reason: another_offer_booked`).
  Booking status: `confirmed` (Phase 3 will add progress/completion states).

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
`offer_out_of_range` (422), `offer_job_mismatch` (422), `payload_too_large` (413),
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
- Privacy: match results and job discovery omit worker coordinates and the employer's address,
  but `GET /workers/{id}` returns the worker's stored coordinates to anyone with the id.
- No secrets in code or responses; `.env` is git-ignored; only `.env.example` is committed.
- CORS is restricted to `LABORLINK_CORS_ORIGINS` and to GET/POST/PATCH.
- No administrative or destructive endpoints exist; no payments are processed.
