# LaborLink API Reference (Phase 1)

- Base URL (local): `http://127.0.0.1:8000`
- All routes are under `/api/v1`. Interactive OpenAPI docs: `/docs` (Swagger) and `/redoc`;
  schema at `/openapi.json`.
- JSON in/out (except image upload, which is `multipart/form-data`). Timestamps are UTC ISO-8601.
- No authentication in Phase 1 (local/demo only).
- Examples below are real responses from the implementation (ids/timestamps vary).

## Error envelope

Every non-2xx response has this shape:

```json
{"error": {"code": "not_found", "message": "Job 'x' was not found.", "details": null}}
```

| HTTP | `code` | When |
|---|---|---|
| 404 | `not_found` | Unknown job id or route |
| 409 | `trade_required` | Recalculating a job whose trade is unknown |
| 413 | `payload_too_large` | Image larger than the upload limit |
| 415 | `unsupported_media_type` | Upload is empty or not JPEG/PNG/WebP |
| 422 | `validation_error` | Request body/field validation failed; `details` lists `{loc, msg, type}` |
| 422 | `invalid_reference` | `image_id` does not exist |
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
- **404** `not_found`, **409** `trade_required` (job has no trade), **503** `database_unavailable`.

---

## Notes for frontend integration (future)

The repository's `frontend/` is currently empty, so no client has been wired up. A client should:

1. Optionally upload the photo with `POST /api/v1/images` and keep the returned `id`.
2. Send speech as a transcript in `description` with `description_source: "voice_transcript"`
   (speech-to-text is not part of the backend in Phase 1).
3. `POST /api/v1/jobs`; show `work_order.follow_up_questions`, the price range and its
   `assumptions`/`warnings`, and label the price as indicative.
4. Add the frontend origin to `LABORLINK_CORS_ORIGINS` if it is not `localhost:5173`/`3000`.
