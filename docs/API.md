# LaborLink API Reference (Phases 1–2)

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
      "Flat travel allowance of INR 50; actual travel distance is not yet used because worker locations are introduced in Phase 2.",
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

Permitted transitions: `estimated → estimated` (recalculate), `estimated → booked` (confirm
booking). Every other transition is rejected. `in_progress` and `completed` belong to Phase 3 and
do not exist yet.

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

The employer selects one offer. Body: `{"offer_id": "<id>"}`.

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

## Notes for frontend integration (future)

The repository's `frontend/` is currently empty, so no client has been wired up. A client should:

1. Optionally upload the photo with `POST /api/v1/images` and keep the returned `id`.
2. Send speech as a transcript in `description` with `description_source: "voice_transcript"`
   (speech-to-text is not part of the backend).
3. `POST /api/v1/jobs`; show `work_order.follow_up_questions`, the price range and its
   `assumptions`/`warnings`, and label the price as indicative.
4. Employer view: `GET /jobs/{id}/matches` for candidates, poll `GET /jobs/{id}/offers`, then
   `POST /jobs/{id}/bookings` with the chosen `offer_id`. Show that profiles are unverified.
5. Worker view: create/patch the profile, poll `GET /workers/{id}/jobs`, show `offer_terms`
   (suggested amount and permitted range) before `POST /jobs/{id}/offers`, and poll
   `GET /workers/{id}/offers` for the outcome.
6. Without authentication the client has to remember its own worker id; this is a demo
   convenience, not a security mechanism.
7. Add the frontend origin to `LABORLINK_CORS_ORIGINS` if it is not `localhost:5173`/`3000`.
   CORS allows GET, POST and PATCH.
