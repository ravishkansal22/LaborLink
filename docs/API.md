# LaborLink API Reference (Phases 1–3)

- Base URL (local): `http://127.0.0.1:8000`
- All routes are under `/api/v1`. Interactive OpenAPI docs: `/docs` (Swagger) and `/redoc`;
  schema at `/openapi.json`.
- JSON in/out (except image upload, which is `multipart/form-data`). Timestamps are UTC ISO-8601.
- **No authentication** (local/demo only). Anyone who can reach the API can create workers, make
  offers and confirm bookings; production use requires access control (see the security notes
  in [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md#security-boundary-development)).
- Examples below are real responses from the implementation (ids/timestamps vary).

## Error envelope

Every non-2xx response has this shape:

```json
{"error": {"code": "not_found", "message": "Job 'x' was not found.", "details": null}}
```

| HTTP | `code` | When |
|---|---|---|
| 404 | `not_found` | Unknown job, worker or route; job has no booking yet |
| 409 | `trade_required` | Job's trade is unknown (`needs_information`): cannot be priced, matched, offered on or booked |
| 409 | `job_not_open` | Job is `booked`: no new offers, matches or recalculation |
| 409 | `job_already_booked` | Booking a job that already has a confirmed booking (including a lost race) |
| 409 | `worker_not_eligible` | Worker's trade, availability or service radius does not fit the job; `details` lists `{issue, message}` |
| 409 | `duplicate_offer` | Worker already has a pending offer for this job; `details` holds its `offer_id` |
| 409 | `estimate_unavailable` | Job has no valid current price estimate, so an offer cannot be validated |
| 409 | `offer_not_pending` | Selected offer is no longer pending |
| 403 | `actor_mismatch` | Supplied `worker_id`/`employer_id` is not the booked worker / the job's employer (prototype check, not authentication) |
| 409 | `employer_not_recorded` | Job has no recorded `employer_id`, so it cannot be confirmed or settled |
| 409 | `job_not_booked` | Start/evidence/review/settlement on a job without a booking |
| 409 | `invalid_status_transition` | Lifecycle step not allowed from the current status (e.g. starting twice) |
| 409 | `job_not_started` | Evidence submitted before the job was started |
| 409 | `evidence_already_submitted` | Evidence already exists for this job (cannot be replaced) |
| 409 | `completion_evidence_missing` | Confirm/dispute before evidence was submitted |
| 409 | `completion_already_reviewed` | The job was already confirmed or disputed |
| 409 | `completion_not_confirmed` | Settlement before the employer confirmed completion |
| 409 | `job_disputed` | Settlement of a disputed job |
| 409 | `already_settled` | The booking's simulated settlement was already recorded |
| 409 | `settlement_inconsistent` | Stored settlement does not match its booking (defensive check) |
| 413 | `payload_too_large` | Image larger than the upload limit |
| 415 | `unsupported_media_type` | Upload is empty or not JPEG/PNG/WebP |
| 422 | `validation_error` | Request body/field validation failed; `details` lists `{loc, msg, type}` |
| 422 | `invalid_reference` | `image_id`, `worker_id` or `offer_id` does not exist |
| 422 | `offer_out_of_range` | Offer amount outside the permitted range; `details` holds the range |
| 422 | `offer_job_mismatch` | Booking an offer that belongs to a different job |
| 500 | `storage_error` | Upload could not be written to disk |
| 500 | `internal_error` | Unexpected error (no internal details are returned) |
| 503 | `database_unavailable` | Database read/write failed; nothing was persisted |

Validation error example:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": [
      {"loc": ["body", "description"], "msg": "String should have at least 3 characters", "type": "string_too_short"},
      {"loc": ["body", "location"], "msg": "Value error, latitude and longitude must be provided together", "type": "value_error"}
    ]
  }
}
```

---

## GET `/api/v1/health`

Application, database, provider and rate-card status. Does not call external model APIs.

- **200** — database reachable, `status: "ok"`
- **503** — database unreachable, `status: "degraded"` (same body shape)

```json
{
  "status": "ok",
  "app": "LaborLink API",
  "version": "0.1.0",
  "environment": "development",
  "checks": {
    "database": {"status": "ok", "detail": null},
    "work_order_provider": {"status": "ok", "detail": "rule_based (offline, deterministic)"},
    "rate_card": {"status": "ok", "detail": "demo-2026-10-v1"}
  },
  "work_order_provider": "rule_based",
  "rate_card_version": "demo-2026-10-v1"
}
```

With `LABORLINK_WORK_ORDER_PROVIDER=anthropic`, `checks.work_order_provider.status` is
`"unverified"` (health checks never make paid calls).

---

## POST `/api/v1/images`

Optional photo upload. `multipart/form-data` with a single field `file`.

- Accepted: JPEG, PNG, WebP — detected from file content, not from the filename or header.
- Max size: `LABORLINK_MAX_UPLOAD_BYTES` (default 5 MB).
- **201** response (values abbreviated):

```json
{
  "id": "0f6c1b0e-3c1e-4a8e-9d6a-2f0b8f6f8a11",
  "content_type": "image/png",
  "size_bytes": 72,
  "sha256": "9b1c…",
  "created_at": "2026-10-16T07:45:02.401000Z"
}
```

- Errors: 413 `payload_too_large`, 415 `unsupported_media_type`, 422 `validation_error`
  (missing `file`), 500 `storage_error`, 503 `database_unavailable`.

```bash
curl -F "file=@leak.jpg" http://127.0.0.1:8000/api/v1/images
```

## GET `/api/v1/images/{image_id}`

Returns the stored photo bytes with its verified type (`image/jpeg`, `image/png` or `image/webp`)
and `X-Content-Type-Options: nosniff`. Used by the app to show job photos and completion evidence.

- **200** image bytes · **404** `not_found` (unknown id, or the file is no longer on disk) · **503**.
- No authentication: anyone with the id can download the photo (demo limitation).

---

## POST `/api/v1/jobs`

Creates a job, generates a structured work order, calculates an indicative FairRate estimate and
persists all of it. Returns **201** only after the data is committed.

### Request body (`JobCreate`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `description` | string, 3–2000 chars (trimmed) | yes | Written description or voice-note transcript |
| `description_source` | `"text"` \| `"voice_transcript"` | no (default `text`) | |
| `language` | string ≤ 16 | no | e.g. `"en"`, `"hi"` |
| `trade` | `"plumber"` \| `"electrician"` \| `"mason"` \| `"carpenter"` | no | Inferred when omitted |
| `urgency` | `"flexible"` \| `"normal"` \| `"urgent"` | no (default `normal`) | |
| `location.address` | string ≤ 500 | one of address / coordinates | |
| `location.latitude`, `location.longitude` | number (−90..90, −180..180) | must be given together | |
| `image_id` | string | no | From `POST /api/v1/images` |
| `employer_id` | string, 1–64 of `A-Z a-z 0-9 _ . : @ -` | no | Self-asserted employer label (Phase 3); needed later to confirm and settle |

Unknown fields are rejected (422).

```json
{
  "description": "Bathroom tap is leaking and dripping since yesterday",
  "description_source": "voice_transcript",
  "language": "en",
  "urgency": "normal",
  "location": {"address": "Navrangpura, Ahmedabad", "latitude": 23.0365, "longitude": 72.5611}
}
```

### Response (`JobResponse`)

| Field | Notes |
|---|---|
| `id` | UUID |
| `status` | `estimated` (has an estimate) or `needs_information` (trade unknown → `price_estimate: null`) |
| `trade` | Final trade (employer's choice, else inferred, else `null`) |
| `employer_id` | Recorded employer label or `null` (added in Phase 3) |
| `request` | Echo of the stored intake (`requested_trade` = employer's choice) |
| `work_order` | `WorkOrderV1` (below) |
| `price_estimate` | Current `PriceEstimate` (below) or `null` |
| `created_at`, `updated_at` | UTC |

```json
{
  "id": "40497135-417d-479f-b705-d6ac59a6a709",
  "status": "estimated",
  "trade": "plumber",
  "request": {
    "description": "Bathroom tap is leaking and dripping since yesterday",
    "description_source": "voice_transcript",
    "language": "en",
    "requested_trade": null,
    "urgency": "normal",
    "location": {"address": "Navrangpura, Ahmedabad", "latitude": 23.0365, "longitude": 72.5611},
    "image_id": null
  },
  "work_order": {
    "schema_version": "1.0",
    "normalized_description": "Bathroom tap is leaking and dripping since yesterday",
    "suggested_trade": "plumber",
    "trade_source": "inferred",
    "trade_confidence": "high",
    "problem_category": "leak_repair",
    "problem_summary": "Leaking pipe, tap or joint needs repair",
    "classification_confidence": "high",
    "complexity": "low",
    "likely_tools": ["pipe wrench", "adjustable spanner", "plumber's tape", "sealant gun"],
    "likely_materials": ["PTFE tape", "washers", "replacement fitting (if worn)"],
    "estimated_duration": {"min_hours": 1.0, "max_hours": 2.0},
    "missing_information": ["A photo of the problem area"],
    "follow_up_questions": [
      "Is the leak from a visible pipe or from inside a wall?",
      "Can you add a photo of the problem area?"
    ],
    "image_assessment": {"status": "not_provided", "observations": [], "disclaimer": "No photo was provided."},
    "generator": {"provider": "rule_based", "model": null, "fallback_used": false, "fallback_reason": null}
  },
  "price_estimate": {
    "id": "bd06f42c-414e-4b76-80af-66caf6649a2b",
    "min_amount": 350,
    "max_amount": 500,
    "currency": "INR",
    "labour": {"min": 300, "max": 450},
    "travel_allowance": 50,
    "materials_included": false,
    "hourly_rate_used": 250.0,
    "multipliers": {"complexity": 0.9, "urgency": 1.0, "combined": 0.9},
    "duration_hours": {"min": 1.0, "max": 2.0},
    "assumptions": [
      "Plumber hourly rate of INR 250 from rate card 'demo-2026-10-v1' (Illustrative demo rates (not tied to a specific city or state)). Illustrative rates for the LaborLink hackathon prototype. They are not official market rates and not statutory minimum wages.",
      "Labour time of 1-2 hours comes from the work order and is an estimate, not a measurement.",
      "Complexity 'low' multiplier 0.9 x urgency 'normal' multiplier 1 = 0.9.",
      "Minimum call-out charge of INR 300 applies.",
      "Flat travel allowance of INR 50; the actual distance to the worker is not priced yet.",
      "Materials and spare parts are not included; they are billed separately at actual cost.",
      "Amounts are rounded outward to the nearest INR 10."
    ],
    "warnings": [
      "Estimated without: A photo of the problem area.",
      "No verified jurisdiction-specific minimum wage is configured for this trade, so the estimate has not been checked against a legal wage floor."
    ],
    "wage_floor_check": {
      "status": "not_configured",
      "detail": "No verified jurisdiction-specific minimum wage is configured for this trade, so the estimate has not been checked against a legal wage floor."
    },
    "rate_card_version": "demo-2026-10-v1",
    "is_indicative": true,
    "created_at": "2026-10-16T07:45:02.411155Z"
  },
  "created_at": "2026-10-16T07:45:02.407137Z",
  "updated_at": "2026-10-16T07:45:02.407137Z"
}
```

#### `WorkOrderV1` fields

| Field | Values |
|---|---|
| `schema_version` | `"1.0"` |
| `suggested_trade` / `trade_source` | trade or `null` / `employer_selected` \| `inferred` \| `unknown` |
| `trade_confidence`, `classification_confidence` | `low` \| `medium` \| `high` |
| `problem_category`, `problem_summary` | e.g. `leak_repair`; `unclassified` when the trade is unknown |
| `complexity` | `low` \| `medium` \| `high` |
| `likely_tools`, `likely_materials` | lists of strings ("likely", not confirmed) |
| `estimated_duration` | `{min_hours, max_hours}`, min ≤ max |
| `missing_information`, `follow_up_questions` | what should be asked before/at booking |
| `image_assessment` | `status`: `not_provided` \| `not_analysed` (rule-based) \| `analysed` (model); `observations` are unverified; `disclaimer` |
| `generator` | `provider`, `model`, `fallback_used`, `fallback_reason` (e.g. `timeout`, `invalid_output`, `refused`) |

#### Incomplete request example

`{"description": "need help asap", "location": {"address": "Surat"}}` → 201 with
`status: "needs_information"`, `trade: null`, `price_estimate: null`, and:

```json
"missing_information": [
  "Which trade is needed (plumber, electrician, mason or carpenter)",
  "A more detailed description of the problem",
  "A photo of the problem area",
  "Map coordinates of the job location (needed to find nearby workers)"
]
```

### Status codes

201, 422 `validation_error` / `invalid_reference`, 503 `database_unavailable`, 500 `internal_error`.

---

## GET `/api/v1/jobs/{job_id}`

Returns the persisted `JobResponse` (same shape as above) with the **current** (latest) estimate.

- **200**, **404** `not_found`, **503** `database_unavailable`.

---

## POST `/api/v1/jobs/{job_id}/price-estimate`

Recalculates the estimate from the stored work order and urgency using the rate card currently
loaded by the server, stores it as a new estimate (history is kept) and makes it current. No
request body.

- **200** — a `PriceEstimate` (same shape as `price_estimate` above, with a new `id`).
- **404** `not_found`, **409** `trade_required` (job has no trade), **409** `job_not_open` (job is
  `booked` — the booking keeps the estimate it was agreed against), **503** `database_unavailable`.

---

# Phase 2 — Workers, matching, offers and booking

## Job lifecycle

| Status | Meaning | Discoverable / matchable / offers / booking |
|---|---|---|
| `needs_information` | Trade unknown, no estimate | No (`409 trade_required`) |
| `estimated` | Work order + current FairRate estimate — **open** | Yes |
| `booked` | A booking is confirmed | No (`409 job_not_open` / `job_already_booked`) |
| `in_progress`, `awaiting_confirmation`, `completed`, `disputed` | Phase 3 execution states (see below) | No |

Permitted transitions: `estimated → estimated` (recalculate), `estimated → booked` (confirm
booking). The Phase 3 transitions after `booked` are listed in the Phase 3 section. Every other
transition is rejected.

## Offer limits (fairness rules)

Offers are validated against the job's **current FairRate estimate** (`price_estimate.labour`):

```
permitted_min           = labour.min × offer_limits.floor_ratio    (rounded up to rounding_step)
permitted_max           = labour.max × offer_limits.ceiling_ratio  (rounded down to rounding_step)
suggested_labour_amount = midpoint of labour.min..labour.max       (rounded half up, clamped)
```

- Configured in `backend/app/data/rate_card.json` → `"offer_limits": {"floor_ratio": 1.0,
  "ceiling_ratio": 1.25}`. `floor_ratio` must be in (0, 1], `ceiling_ratio` in [1, 3].
- With the default `floor_ratio` of 1.0 a worker cannot undercut the estimate's minimum labour,
  which prevents a race to the bottom; the ceiling protects the employer.
- These are **illustrative LaborLink platform limits, not legal minimum wages**. They inherit the
  estimate's wage-floor status (by default `not_configured`).
- Offer amounts are **labour only**. Each offer also records the estimate's flat
  `travel_allowance`; `total_amount = labour_amount + travel_allowance`. Materials are excluded.
- At booking time the amount is checked again against the job's *current* estimate.

---

## POST `/api/v1/workers`

Create a worker profile. Profiles are **self-declared**: `verification_status` is always
`"unverified"`; LaborLink performs no identity, document or skill checks.

| Field | Type | Required | Rules |
|---|---|---|---|
| `display_name` | string | yes | 2–80 chars, whitespace collapsed |
| `trades` | list of `plumber` \| `electrician` \| `mason` \| `carpenter` | yes | 1–4, no duplicates |
| `years_experience` | integer | no | 0–60, self-reported |
| `location.latitude` / `location.longitude` | number | yes | −90..90 / −180..180 |
| `location.locality` | string | no | ≤ 120 chars |
| `service_radius_km` | number | no (default 10) | > 0 and ≤ 50 |
| `availability` | `available` \| `unavailable` | no (default `available`) | |

```json
{
  "display_name": "Ramesh Patel",
  "trades": ["plumber"],
  "years_experience": 8,
  "location": {"latitude": 23.0225, "longitude": 72.5714, "locality": "Ellisbridge"},
  "service_radius_km": 8
}
```

**201**:

```json
{
  "id": "7de3a40c-9478-46ab-9231-6e4b6085fbdc",
  "display_name": "Ramesh Patel",
  "trades": ["plumber"],
  "years_experience": 8,
  "location": {"latitude": 23.0225, "longitude": 72.5714, "locality": "Ellisbridge"},
  "service_radius_km": 8.0,
  "availability": "available",
  "verification_status": "unverified",
  "created_at": "2026-10-16T07:58:23.333829Z",
  "updated_at": "2026-10-16T07:58:23.333829Z"
}
```

Errors: 422 `validation_error`, 503 `database_unavailable`.

## GET `/api/v1/workers/{worker_id}`

**200** `WorkerResponse` (as above) · **404** `not_found`.

## PATCH `/api/v1/workers/{worker_id}`

Partial update: send only the fields to change (same rules as create). `years_experience` may be
set to `null`; other fields may not. `location` is replaced as a whole. An empty body is rejected.

```json
{"availability": "unavailable"}
```

**200** updated `WorkerResponse` · **404** `not_found` · **422** `validation_error`.

---

## GET `/api/v1/jobs/{job_id}/matches?limit=20`

Ranked workers for an open job. `limit` 1–100 (default 20).

Eligibility: the worker lists the job's trade, is `available`, and — when the job has coordinates —
the haversine distance is within the worker's `service_radius_km`.

Score (0–100), **price is never used**: distance up to 60 points (`60 × (1 − distance/radius)`)
plus experience up to 40 points (`40 × min(years, 10)/10`). Ties: nearer first, then worker id.

If the job has **no coordinates**, `distance_matching` is `"unavailable"`, `distance_km` and
`within_service_radius` are `null` (never invented), the radius rule is not applied, and a
limitation explains why. `excluded` counts workers filtered out (each under its first failing
rule) without exposing them.

```json
{
  "job_id": "3dfc392e-8de0-4f75-93f7-a7d2f4be47ba",
  "trade": "plumber",
  "distance_matching": "complete",
  "limitations": [],
  "scoring": "score = distance points (up to 60, closer within the worker's service radius is better) + experience points (up to 40, capped at 10 years). Price is not used for ranking. Ties: nearer first, then worker id.",
  "candidates": [
    {
      "worker": {"id": "7de3a40c-9478-46ab-9231-6e4b6085fbdc", "display_name": "Ramesh Patel",
                 "trades": ["plumber"], "years_experience": 8, "verification_status": "unverified"},
      "availability": "available",
      "distance_km": 1.88,
      "service_radius_km": 8.0,
      "within_service_radius": true,
      "score": 77.9,
      "score_breakdown": {"distance": 45.9, "experience": 32.0},
      "reasons": ["Offers plumber work", "Marked as available",
                  "1.88 km away, within a 8 km service radius",
                  "8 years of self-reported experience"],
      "limitations": []
    }
  ],
  "excluded": {"trade_mismatch": 0, "unavailable": 0, "outside_service_radius": 0}
}
```

Worker coordinates are not included. Errors: 404 `not_found`, 409 `trade_required` /
`job_not_open`, 422 (bad `limit`).

## GET `/api/v1/workers/{worker_id}/jobs?limit=20`

Open (`estimated`) jobs matching the worker's trades and service area, nearest first (jobs without
coordinates last, with a limitation). The employer's address, coordinates and request details are
**not** included. An `unavailable` worker gets an empty list and a limitation. Poll this endpoint
for new jobs (no push notifications).

```json
{
  "worker_id": "8b870fe5-0edc-4db1-93bb-cc0e5d424d98",
  "worker_availability": "available",
  "limitations": [],
  "items": [
    {
      "job_id": "3dfc392e-8de0-4f75-93f7-a7d2f4be47ba",
      "trade": "plumber",
      "problem_category": "leak_repair",
      "problem_summary": "Leaking pipe, tap or joint needs repair",
      "complexity": "low",
      "urgency": "normal",
      "estimated_duration": {"min_hours": 1.0, "max_hours": 2.0},
      "distance_km": 1.88,
      "limitations": [],
      "offer_terms": {
        "price_estimate_id": "17568e85-51a3-4c95-ba30-2e9fac4ce3ed",
        "currency": "INR",
        "suggested_labour_amount": 380,
        "permitted_min": 300,
        "permitted_max": 560,
        "travel_allowance": 50,
        "basis": "Labour estimate INR 300-INR 450; offers allowed from 1x the minimum to 1.25x the maximum (illustrative LaborLink policy, not a legal requirement)."
      },
      "has_active_offer": false,
      "created_at": "2026-10-16T07:58:23.269435Z"
    }
  ]
}
```

Errors: 404 `not_found`.

---

## POST `/api/v1/jobs/{job_id}/offers`

A worker responds to an open job.

| Field | Type | Rules |
|---|---|---|
| `worker_id` | string | must exist (`422 invalid_reference`) |
| `kind` | `accept_suggested` \| `counter` | |
| `labour_amount` | integer > 0 | **required** for `counter`; **must be omitted** for `accept_suggested` (which uses `suggested_labour_amount`) |
| `message` | string ≤ 280 | optional |

Checks, in order: job exists (404) → job open (409 `trade_required` / `job_not_open`) → worker
exists (422) → current estimate valid (409 `estimate_unavailable`) → worker eligible (409
`worker_not_eligible`) → no pending offer by this worker for this job (409 `duplicate_offer`; also
enforced by a database index) → counter amount within the permitted range (422
`offer_out_of_range`).

```json
{"worker_id": "8b870fe5-0edc-4db1-93bb-cc0e5d424d98", "kind": "counter",
 "labour_amount": 450, "message": "Can come this evening"}
```

**201** `OfferResponse`:

```json
{
  "id": "f832a282-8990-4417-b501-f8ea61bfda3f",
  "job_id": "3dfc392e-8de0-4f75-93f7-a7d2f4be47ba",
  "worker": {"id": "8b870fe5-0edc-4db1-93bb-cc0e5d424d98", "display_name": "Sunil Kumar",
             "trades": ["plumber", "mason"], "years_experience": 2,
             "verification_status": "unverified"},
  "kind": "counter",
  "labour_amount": 450,
  "travel_allowance": 50,
  "total_amount": 500,
  "currency": "INR",
  "price_estimate_id": "17568e85-51a3-4c95-ba30-2e9fac4ce3ed",
  "message": "Can come this evening",
  "status": "pending",
  "closed_reason": null,
  "created_at": "2026-10-16T07:58:23.468869Z",
  "updated_at": "2026-10-16T07:58:23.468869Z"
}
```

Out-of-range example (422):

```json
{"error": {"code": "offer_out_of_range",
  "message": "labour_amount must be between 300 and 560 INR.",
  "details": [{"permitted_min": 300, "permitted_max": 560, "currency": "INR",
               "basis": "Labour estimate INR 300-INR 450; offers allowed from 1x the minimum to 1.25x the maximum (illustrative LaborLink policy, not a legal requirement)."}]}}
```

Offer statuses: `pending` → `accepted` (selected in a booking) or `rejected` (closed with
`closed_reason: "another_offer_booked"`). Offers cannot be edited or withdrawn in Phase 2.

## GET `/api/v1/jobs/{job_id}/offers`

All offers for a job (any status), **oldest first** — not sorted by price — with comparison
context: `distance_km`, `match_score` (null if the worker is no longer eligible),
`difference_from_suggested`, `currently_eligible` and `eligibility_issues`. `offer_terms` holds the
current terms (or `null` if the job has no valid estimate).

```json
{
  "job_id": "3dfc392e-8de0-4f75-93f7-a7d2f4be47ba",
  "job_status": "estimated",
  "offer_terms": {"price_estimate_id": "17568e85-…", "currency": "INR", "suggested_labour_amount": 380,
                  "permitted_min": 300, "permitted_max": 560, "travel_allowance": 50, "basis": "…"},
  "ordering": "Oldest first. Offers are not ranked by price; compare amount, distance, experience and match_score.",
  "offers": [
    {"id": "b5040066-…", "kind": "accept_suggested", "labour_amount": 380, "total_amount": 430,
     "status": "pending", "worker": {"display_name": "Ramesh Patel", "years_experience": 8, "…": "…"},
     "distance_km": 1.88, "match_score": 77.9, "difference_from_suggested": 0,
     "currently_eligible": true, "eligibility_issues": [], "…": "…"},
    {"id": "f832a282-…", "kind": "counter", "labour_amount": 450, "total_amount": 500,
     "status": "pending", "worker": {"display_name": "Sunil Kumar", "years_experience": 2, "…": "…"},
     "distance_km": 1.88, "match_score": 56.72, "difference_from_suggested": 70,
     "currently_eligible": true, "eligibility_issues": [], "…": "…"}
  ]
}
```

(`…` marks fields shortened here; each offer contains every `OfferResponse` field.)
Errors: 404 `not_found`.

## GET `/api/v1/workers/{worker_id}/offers`

The worker's offers, newest first. Each item is an `OfferResponse` plus `job_status`, `job_trade`
and `problem_summary`, so a worker can see whether an offer was accepted or closed
(`"status": "rejected", "closed_reason": "another_offer_booked"`). Errors: 404 `not_found`.

---

## POST `/api/v1/jobs/{job_id}/bookings`

The employer selects one offer. Body: `{"offer_id": "<id>"}`, optionally with
`"employer_id"` (Phase 3): it records the employer on a job created without one, and must match
the job's `employer_id` if it already has one (otherwise `403 actor_mismatch`).

Checks: job exists (404) → offer exists (422 `invalid_reference`) → offer belongs to the job (422
`offer_job_mismatch`) → job not already booked (409 `job_already_booked`) and open (409
`trade_required`) → offer pending (409 `offer_not_pending`) → worker still eligible (409
`worker_not_eligible`) → amount still within the current permitted range (422
`offer_out_of_range`).

Then, in **one transaction**: the job moves `estimated → booked` (conditional update), a booking
row is created, the offer becomes `accepted`, and every other pending offer becomes `rejected`
with `closed_reason: "another_offer_booked"`. If two bookings race, exactly one succeeds and the
other gets `409 job_already_booked`. On a database failure nothing changes (503).

**201** `BookingResponse`:

```json
{
  "id": "d87a94f7-f119-4e5e-a3b1-6b1a21611c11",
  "job_id": "3dfc392e-8de0-4f75-93f7-a7d2f4be47ba",
  "offer_id": "b5040066-229b-40ba-9906-cf5155a81538",
  "status": "confirmed",
  "worker": {"id": "7de3a40c-9478-46ab-9231-6e4b6085fbdc", "display_name": "Ramesh Patel",
             "trades": ["plumber"], "years_experience": 8, "verification_status": "unverified"},
  "agreed_labour_amount": 380,
  "travel_allowance": 50,
  "agreed_total_amount": 430,
  "currency": "INR",
  "price_estimate_id": "17568e85-51a3-4c95-ba30-2e9fac4ce3ed",
  "payment": "not_handled",
  "created_at": "2026-10-16T07:58:23.516608Z"
}
```

`payment: "not_handled"` — LaborLink does not process payments or escrow.

## GET `/api/v1/jobs/{job_id}/booking`

**200** `BookingResponse` · **404** `not_found` (unknown job, or the job has no booking yet).

---

# Phase 3 — Job completion, simulated settlement and Kamai Passbook

## Actors (prototype identity)

There is **no authentication**. Phase 3 actions carry a self-asserted actor label that is checked
against the stored records so the demo follows the right roles; anyone who knows the ids can
still send them. A mismatch returns **403 `actor_mismatch`**.

| Action | Actor field | Must equal |
|---|---|---|
| Start job, submit evidence | `worker_id` | the worker on the job's booking |
| Confirm/dispute, settle | `employer_id` | the job's recorded `employer_id` |

`employer_id` (1–64 chars of `A-Z a-z 0-9 _ . : @ -`) is recorded either when the job is created
(`POST /jobs`) or, for jobs created without one, when the booking is confirmed
(`POST /jobs/{id}/bookings` with `employer_id`). If a job has no recorded employer, confirmation,
dispute and settlement return **409 `employer_not_recorded`**.

Employer-reference rules:

- A booking stores `employer_id` **only if the job has none yet**. Sending the same id again is
  accepted; sending a different id returns `403 actor_mismatch` and nothing is booked or changed.
  Omitting it keeps the existing reference.
- Once a job is booked, no endpoint can set or change its employer: a later booking request returns
  `409 job_already_booked` before `employer_id` is considered, so knowing a job id is not enough to
  claim it.
- **Historical limitation:** a job that was already booked without an employer (e.g. booked under
  Phase 2) cannot be confirmed, disputed or settled through the API. The worker can still start it
  and submit evidence. See
  [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md#employer-reference-rules-and-historical-jobs)
  for the manual operator path.

## Lifecycle after booking

```
booked ──POST /start──▶ in_progress ──POST /completion-evidence──▶ awaiting_confirmation
awaiting_confirmation ──POST /completion-confirmation {confirm}──▶ completed  (+ simulated_pending settlement)
awaiting_confirmation ──POST /completion-confirmation {dispute}──▶ disputed   (no settlement, ever)
completed: settlement simulated_pending ──POST /settlement──▶ simulated_settled
```

`completed` and `disputed` are final in this prototype; dispute resolution is not implemented.
Any other transition returns **409 `invalid_status_transition`** with `current_status` in
`details`.

## Simulated settlement — what it is and is not

- A **demo ledger record**. No money moves; there is no payment gateway, escrow, bank or wallet
  integration. Every response says `"mode": "simulated"` and carries a disclaimer.
- The amount is always the booking's agreed total (`agreed_labour_amount + travel_allowance`).
  The API never accepts an amount: sending one returns `422 validation_error`.
- Created as `simulated_pending` in the same transaction as the employer's confirmation; moved to
  `simulated_settled` exactly once by `POST /settlement`. One settlement per booking, enforced by
  UNIQUE constraints.

---

## POST `/api/v1/jobs/{job_id}/start`

Body: `{"worker_id": "<booked worker id>"}`

**200**:

```json
{
  "job_id": "1798cb14-91e9-424e-97e0-e7590dca87a8",
  "job_status": "in_progress",
  "booking_id": "aa6fd84e-4b4b-41e2-881a-939f639062a0",
  "worker_id": "0ebc8c53-8074-4a90-a276-45593402da96",
  "started_at": "2026-10-16T08:40:03.087218Z"
}
```

Errors: 404 `not_found` · 409 `job_not_booked` (no booking) · 403 `actor_mismatch` · 409
`invalid_status_transition` (e.g. already started):

```json
{"error": {"code": "invalid_status_transition",
  "message": "Job '1798cb14-…' cannot move from 'in_progress' to 'in_progress'.",
  "details": [{"current_status": "in_progress", "requested_status": "in_progress"}]}}
```

## POST `/api/v1/jobs/{job_id}/completion-evidence`

Upload photos first with `POST /api/v1/images` (same validation and storage as Phase 1), then
reference their ids.

| Field | Rules |
|---|---|
| `worker_id` | required; the booked worker |
| `after_image_ids` | required, 1–5 uploaded image ids |
| `before_image_ids` | optional, 0–5 uploaded image ids |
| `note` | optional, ≤ 500 chars |

An image id may appear only once across both lists. **One submission per job**: evidence cannot
be replaced once submitted (`409 evidence_already_submitted`).

```json
{"worker_id": "0ebc8c53-8074-4a90-a276-45593402da96",
 "before_image_ids": ["0542cfe7-2015-48a3-ae08-81b433bd0454"],
 "after_image_ids": ["63eea666-5224-4e35-842e-d372cfd1d9f9"],
 "note": "Replaced the washer and resealed the joint."}
```

**201** (also returned by `GET`):

```json
{
  "id": "2046b8fd-f0d0-4e47-81e5-1bb57023ab30",
  "job_id": "1798cb14-91e9-424e-97e0-e7590dca87a8",
  "booking_id": "aa6fd84e-4b4b-41e2-881a-939f639062a0",
  "worker_id": "0ebc8c53-8074-4a90-a276-45593402da96",
  "before_images": [{"image_id": "0542cfe7-2015-48a3-ae08-81b433bd0454", "content_type": "image/png",
                     "size_bytes": 69, "sha256": "b1ff9c8e…"}],
  "after_images": [{"image_id": "63eea666-5224-4e35-842e-d372cfd1d9f9", "content_type": "image/png",
                    "size_bytes": 70, "sha256": "cf89e1e6…"}],
  "note": "Replaced the washer and resealed the joint.",
  "submitted_at": "2026-10-16T08:40:03.150311Z",
  "job_status": "awaiting_confirmation",
  "disclaimer": "Photos and notes support the employer's review. They do not prove the quality or correctness of the work."
}
```

Errors: 404 · 409 `job_not_booked` · 403 `actor_mismatch` · 409 `job_not_started` (still
`booked`) · 409 `evidence_already_submitted` · 422 `validation_error` (no after photo, duplicates,
too many) · 422 `invalid_reference` with `details: [{"missing_image_ids": [...]}]`.

## GET `/api/v1/jobs/{job_id}/completion-evidence`

**200** `EvidenceResponse` (above) · **404** unknown job or no evidence yet.

## POST `/api/v1/jobs/{job_id}/completion-confirmation`

| Field | Rules |
|---|---|
| `employer_id` | required; the job's employer |
| `decision` | `"confirm"` or `"dispute"` |
| `dispute_reason` | required (5–500 chars) for `dispute`; must be omitted for `confirm` |

Confirm: `{"employer_id": "employer-anita", "decision": "confirm"}` → **201**:

```json
{
  "id": "96a053cb-ddf4-4a34-a450-1fa7c21af177",
  "job_id": "1798cb14-91e9-424e-97e0-e7590dca87a8",
  "booking_id": "aa6fd84e-4b4b-41e2-881a-939f639062a0",
  "evidence_id": "2046b8fd-f0d0-4e47-81e5-1bb57023ab30",
  "employer_id": "employer-anita",
  "decision": "confirmed",
  "dispute_reason": null,
  "agreed_amount": {"labour_amount": 380, "travel_allowance": 50, "total_amount": 430, "currency": "INR"},
  "reviewed_at": "2026-10-16T08:40:03.198971Z",
  "job_status": "completed",
  "settlement": {
    "id": "82a2cb00-4a0f-4553-9f3c-c9c4886dec25",
    "job_id": "1798cb14-91e9-424e-97e0-e7590dca87a8",
    "booking_id": "aa6fd84e-4b4b-41e2-881a-939f639062a0",
    "worker_id": "0ebc8c53-8074-4a90-a276-45593402da96",
    "employer_id": "employer-anita",
    "amount": 430, "labour_amount": 380, "travel_allowance": 50, "currency": "INR",
    "status": "simulated_pending", "mode": "simulated",
    "created_at": "2026-10-16T08:40:03.202005Z", "settled_at": null,
    "disclaimer": "Simulated demo settlement. No money has been moved: LaborLink does not process payments, hold funds in escrow or connect to banks."
  },
  "note": "Completion confirmed. A simulated settlement for the agreed amount is pending; record it with POST /api/v1/jobs/{job_id}/settlement."
}
```

Dispute: `{"employer_id": "employer-anita", "decision": "dispute", "dispute_reason": "Tap still
leaks after the repair"}` → **201** with `"decision": "disputed"`, `"job_status": "disputed"`,
the trimmed `dispute_reason`, `"settlement": null` and the note *"Completion disputed. The job
will not be settled and the worker is not credited. Dispute resolution is not implemented in this
prototype."*

The decision is final: a second request (either decision) returns **409
`completion_already_reviewed`** with the existing `review_id` in `details`; no second record is
created. Other errors: 404 · 409 `job_not_booked` · 409 `employer_not_recorded` · 403
`actor_mismatch` · 409 `completion_evidence_missing` (job `booked` or `in_progress`) · 422
`validation_error`.

## POST `/api/v1/jobs/{job_id}/settlement`

Body: `{"employer_id": "employer-anita"}` — **no amount field is accepted.**

**200** — the settlement moved from `simulated_pending` to `simulated_settled`:

```json
{
  "id": "82a2cb00-4a0f-4553-9f3c-c9c4886dec25",
  "job_id": "1798cb14-91e9-424e-97e0-e7590dca87a8",
  "booking_id": "aa6fd84e-4b4b-41e2-881a-939f639062a0",
  "worker_id": "0ebc8c53-8074-4a90-a276-45593402da96",
  "employer_id": "employer-anita",
  "amount": 430,
  "labour_amount": 380,
  "travel_allowance": 50,
  "currency": "INR",
  "status": "simulated_settled",
  "mode": "simulated",
  "created_at": "2026-10-16T08:40:03.202005Z",
  "settled_at": "2026-10-16T08:40:03.220113Z",
  "disclaimer": "Simulated demo settlement. No money has been moved: LaborLink does not process payments, hold funds in escrow or connect to banks."
}
```

Errors: 404 · 409 `job_not_booked` · 409 `employer_not_recorded` · 403 `actor_mismatch` · 409
`job_disputed` · 409 `completion_not_confirmed` · 409 `already_settled` (repeat requests; details
hold `settlement_id` and `settled_at`) · 409 `settlement_inconsistent` (stored record does not
match the booking — should never happen) · 422 `validation_error` (e.g. an `amount` field) · 503.

## GET `/api/v1/jobs/{job_id}/settlement`

**200** `SettlementResponse` (pending or settled) · **404** if there is no settlement yet — the
message says whether completion is unconfirmed or the job is disputed.

## Live worker location

While a job is `booked` (worker travelling) or `in_progress` (on site), the booked worker can share
their position and the job's employer can see it with an approximate arrival time. Only the latest
position is stored (each update replaces the previous one), and sharing is refused once the job
moves on (`409 tracking_not_active`).

**Arrival estimate:** straight-line distance × 1.3 at 20 km/h (city two-wheeler speed), rounded up
to whole minutes; `arrived` is true within 150 m or once the job is `in_progress`. It is not a
routed or traffic-aware estimate, and the response says so in `eta_basis`.

### POST `/api/v1/jobs/{job_id}/worker-location`

Body: `{"worker_id": "...", "latitude": 28.6519, "longitude": 77.1909, "accuracy_m": 12}` —
`accuracy_m` optional. **200** returns the tracking view below (so the worker sees their own ETA).

Errors: 404 · 409 `job_not_booked` · 403 `actor_mismatch` (not the booked worker) · 409
`tracking_not_active` · 422 `validation_error` (coordinates out of range, unknown fields).

### GET `/api/v1/jobs/{job_id}/worker-location?employer_id=...`

**200**:

```json
{
  "job_id": "ec293410-359b-48dd-a358-925e44da7699",
  "job_status": "booked",
  "worker_id": "0e433bd0-fca7-4447-b882-62ecabcb0bec",
  "worker_name": "Manoj Kumar",
  "worker_location": {"latitude": 28.6403, "longitude": 77.2034, "accuracy_m": 10,
                      "recorded_at": "2026-10-16T15:00:31Z", "age_seconds": 2, "stale": false},
  "destination": {"latitude": 28.6315, "longitude": 77.2167, "address": "Flat 402, Block B, Connaught Place"},
  "distance_km": 2.03,
  "eta_minutes": 8,
  "arrived": false,
  "eta_basis": "Approximate: straight-line distance x 1.3 at 20 km/h city speed. It is not a routed or traffic-aware estimate."
}
```

`worker_location` is `null` until the worker starts sharing; `stale` is true when the last update
is older than 2 minutes. If the job has no coordinates, `destination`, `distance_km` and
`eta_minutes` are `null`. Errors: 404 · 409 `job_not_booked` · 409 `employer_not_recorded` · 403
`actor_mismatch` · 409 `tracking_not_active` · 422 (bad `employer_id`).

---

## GET `/api/v1/workers/{worker_id}/passbook?limit=50`

Kamai Passbook, computed on every request from bookings, completion reviews and settlements
(no stored totals, so repeated calls never double-count). `limit` (1–200) limits `entries` only;
`summary` always covers all of the worker's bookings. It is a work and earnings history for this
prototype — **not a bank statement, credit score or proof of loan eligibility.**

Each entry's `earning_status`:

| `earning_status` | Meaning | Counted in |
|---|---|---|
| `in_progress` | booked / in progress / awaiting confirmation | `active_jobs` only |
| `confirmed_unsettled` | employer confirmed; simulated settlement pending | `completed_jobs`, `confirmed_earnings`, `pending_settlements` |
| `settled` | simulated settlement recorded | `completed_jobs`, `confirmed_earnings`, `simulated_settled_earnings` |
| `disputed` | employer disputed; `settlement_status: "withheld_disputed"` | `disputed` only — never earnings |

```json
{
  "worker_id": "0ebc8c53-8074-4a90-a276-45593402da96",
  "worker_display_name": "Ramesh Patel",
  "currency": "INR",
  "summary": {
    "completed_jobs": 1,
    "confirmed_earnings": 430,
    "simulated_settled_earnings": 430,
    "pending_settlements": {"count": 0, "amount": 0},
    "disputed": {"count": 0, "amount": 0},
    "active_jobs": 0
  },
  "entries": [
    {
      "job_id": "1798cb14-91e9-424e-97e0-e7590dca87a8",
      "booking_id": "aa6fd84e-4b4b-41e2-881a-939f639062a0",
      "trade": "plumber",
      "problem_summary": "Leaking pipe, tap or joint needs repair",
      "job_status": "completed",
      "earning_status": "settled",
      "agreed_labour_amount": 380,
      "travel_allowance": 50,
      "agreed_total_amount": 430,
      "currency": "INR",
      "booked_at": "2026-10-16T08:40:03.057237Z",
      "completed_at": "2026-10-16T08:40:03.198971Z",
      "disputed_at": null,
      "dispute_reason": null,
      "settlement_status": "simulated_settled",
      "settled_at": "2026-10-16T08:40:03.220113Z"
    }
  ],
  "total_entries": 1,
  "limit": 50,
  "disclaimer": "Kamai Passbook: a work and earnings history computed from this prototype's records. Settlements are simulated. It is not a bank statement, a credit score or proof of loan eligibility."
}
```

Entries are newest first (by completion/dispute time, else booking time). Errors: 404
`not_found`, 422 (bad `limit`).

---

## Notes for frontend integration (future)

The repository's `frontend/` is currently empty, so no client has been wired up. A client should:

1. Optionally upload the photo with `POST /api/v1/images` and keep the returned `id`.
2. Send speech as a transcript in `description` with `description_source: "voice_transcript"`
   (speech-to-text is not part of the backend).
3. `POST /api/v1/jobs` (include `employer_id` so the employer can later confirm and settle); show
   `work_order.follow_up_questions`, the price range and its `assumptions`/`warnings`, and label
   the price as indicative.
4. Employer view: `GET /jobs/{id}/matches` for candidates, poll `GET /jobs/{id}/offers`, then
   `POST /jobs/{id}/bookings` with the chosen `offer_id`. Show that profiles are unverified.
5. Worker view: create/patch the profile, poll `GET /workers/{id}/jobs`, show `offer_terms`
   (suggested amount and permitted range) before `POST /jobs/{id}/offers`, and poll
   `GET /workers/{id}/offers` for the outcome.
6. Execution: the worker calls `/start`, uploads photos via `/images` and posts
   `/completion-evidence`; the employer reviews `GET /completion-evidence` and posts
   `/completion-confirmation`, then `/settlement`. Label every settlement as **simulated**.
7. Show `GET /workers/{id}/passbook` with its disclaimer; do not present it as a bank statement.
8. Without authentication the client must remember its own worker/employer ids; this is a demo
   convenience, not a security mechanism.
9. Add the frontend origin to `LABORLINK_CORS_ORIGINS` if it is not `localhost:5173`/`3000`.
   CORS allows GET, POST and PATCH.
