# Backend Architecture (Phase 1)

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
│   ├── models.py               # ORM: Job, WorkOrderRecord, PriceEstimateRecord, ImageUpload
│   ├── errors.py               # AppError hierarchy + handlers → {"error": {...}} envelope
│   ├── data/rate_card.json     # FairRate configuration (illustrative rates)
│   ├── schemas/                # Pydantic: common enums, jobs, work_order (v1), pricing
│   ├── api/
│   │   ├── deps.py             # dependencies reading shared objects from app.state
│   │   └── v1/                 # health.py, jobs.py, images.py  (mounted at /api/v1)
│   └── services/
│       ├── jobs.py             # create / get / recalculate; transaction boundaries
│       ├── pricing.py          # FairRate formula + rate-card loader
│       ├── images.py           # validated photo storage
│       ├── db_guard.py         # SQLAlchemy errors → 503 database_unavailable
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
- Materials are excluded; travel is a flat allowance until worker locations exist (Phase 2).
- Pure function, deterministic for identical inputs; the rate card is validated at startup
  (missing trades, non-positive multipliers or unsourced wage floors stop the app from starting).

## Data model

| Table | Key columns | Notes |
|---|---|---|
| `jobs` | `id` (UUID4), `status`, `description`, `description_source`, `language`, `requested_trade`, `trade`, `urgency`, `address`, `latitude`, `longitude`, `image_id`, `created_at`, `updated_at` | Central record; later phases attach workers/bids/bookings by `jobs.id` |
| `work_orders` | `job_id` (unique FK), `schema_version`, `provider`, `payload` (JSON) | Validated `WorkOrderV1` |
| `price_estimates` | `job_id` (FK), `sequence`, `rate_card_version`, `currency`, `min_amount`, `max_amount`, `payload` (JSON) | Append-only history |
| `image_uploads` | `id`, `stored_filename`, `original_filename` (sanitised), `content_type`, `size_bytes`, `sha256` | Binary stored on disk, not in the DB |

Timestamps are stored as UTC and returned as timezone-aware ISO-8601 (`...Z`). Tables are created
with `create_all` at startup / via `python -m app.init_db`; there are no migrations yet (add Alembic
before the first schema change on a database you need to keep).

Job statuses in Phase 1: `estimated`, `needs_information`. Phase 2 is expected to add statuses such
as `open`, `booked`; Phase 3 `completed`, `settled`.

## Image uploads

`POST /api/v1/images` (multipart field `file`): type detected from magic bytes (JPEG/PNG/WebP
only), size enforced while reading (`LABORLINK_MAX_UPLOAD_BYTES`, default 5 MB), stored as
`<uuid>.<ext>` in `LABORLINK_UPLOAD_DIR` (default `backend/var/uploads`, git-ignored). Files are
never executed and not served back in Phase 1. If the DB write fails the file is deleted.

## Errors

All errors use `{"error": {"code", "message", "details"}}`. Codes: `validation_error` (422),
`invalid_reference` (422), `not_found` (404), `trade_required` (409), `payload_too_large` (413),
`unsupported_media_type` (415), `database_unavailable` (503), `storage_error` (500),
`internal_error` (500, no internal details). See [API.md](./API.md).

## Security boundary (development)

- No authentication in Phase 1: the API is intended for local/demo use only. Do not expose it
  publicly as-is. Worker/employer accounts arrive with Phase 2.
- No secrets in code or responses; `.env` is git-ignored; only `.env.example` is committed.
- CORS is restricted to `LABORLINK_CORS_ORIGINS` and to GET/POST.
- No administrative or destructive endpoints exist.
