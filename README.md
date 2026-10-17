# LaborLink

**Fair, transparent work for India's daily-wage skilled workers.**

LaborLink connects households and small businesses with nearby plumbers, electricians, masons and
carpenters. The employer describes a problem with a photo and their voice. LaborLink turns that
into a clear work order and an explainable fair price. Nearby workers make offers, and the
employer books one and watches the worker travel to their home on a live map. After the job, the
worker gets a verifiable record of the work and their earnings in a digital **Kamai Passbook**.

> **Hackathon prototype.** Payments are *simulated* and there are no user accounts or
> authentication. Do not use it with real money or personal data. See [Limitations](#limitations).

---

## Contents

- [The problem](#the-problem)
- [Our solution](#our-solution)
- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Try the full demo](#try-the-full-demo)
- [Configuration](#configuration)
- [Tests and checks](#tests-and-checks)
- [API overview](#api-overview)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

---

## The problem

Skilled daily-wage workers mostly find work through labour chowks, middlemen and word of mouth.

- **Employers** struggle to describe the job precisely. They have no reference for a fair price,
  and can't easily find a suitable worker nearby or know when that worker will arrive.
- **Workers** face unpredictable income and haggling with no reference point. They also have no
  verifiable record of the work they've done, which keeps them out of formal credit and benefits.

## Our solution

| Step | What LaborLink does |
|---|---|
| 1. Describe | The employer adds a photo and speaks or types the problem in English, Hindi or Hinglish. |
| 2. Understand | The description becomes a **structured work order**: trade, problem summary, likely tools and materials, duration, complexity, and follow-up questions. |
| 3. Price fairly | **FairRate** gives a price range (labour + travel). Every assumption and multiplier is shown, so nothing is a black box. |
| 4. Match & book | Matching workers nearby see the job. Each one accepts the suggested amount or counter-offers within fair limits, and the employer books one. |
| 5. Track | The employer watches the worker come to their home on a live map, with the arrival time and journey progress, like a ride-hailing app. |
| 6. Complete | The worker uploads before and after photos, and the employer confirms the work or reports a problem. |
| 7. Get paid & recorded | Confirmed work gets a **simulated** settlement and appears in the worker's **Kamai Passbook**. |

## Features

**Employer app**
- Photo and voice/text job intake. Voice is transcribed by **Sarvam AI** (Hindi, English,
  Hinglish, any browser) when the server has a key, or by the browser's own speech recognition.
- The job title is the employer's own words, so the worker sees exactly what was described.
- Work order and FairRate price range, with a "How we worked it out" breakdown.
- Live offers from matching workers, with distance, experience and amount, and one-tap booking.
- **Live trip tracking:**
  - A full-screen map shows the worker as a moving arrow on the road route to your home.
  - A bottom sheet shows "Arriving in N min", a journey progress bar and the worker's details.
  - An "on the way" banner appears on the home screen.
- A completion review with the worker's photos, then confirm, or report a problem.
- A simulated payment, plus a list of all jobs and their status.

**Worker app**
- A profile with trades, experience, home area, service radius and an availability toggle.
- **Find work:** nearby matching jobs with the suggested pay. Accept it or counter-offer.
- **Trip screen:**
  - Shares live GPS automatically, or runs a labelled demo trip when location is off.
  - Opens navigation in Google Maps.
  - Swipe to start the job.
- Before/after photo upload, then send for confirmation.
- **Kamai Passbook:** completed jobs, confirmed earnings and payment status.

**Design**
- Mobile-first UI shown inside a phone frame on desktop. On a real phone it's full screen.
- English and Hindi labels, large touch targets, and a simple step-by-step flow for low-literacy
  users.

## How it works

```
┌──────────────────────────┐   /api/v1/*   ┌──────────────────────────────┐
│  Next.js 14 frontend     │ ────────────▶ │  FastAPI backend             │
│  (phone-style web app)   │   (proxied by │  • work orders (rule-based   │
│  • Leaflet + OSM map     │    Next.js)   │    or optional Claude model) │
│  • OSRM road routes      │               │  • FairRate pricing          │
│  • browser GPS / speech  │               │  • matching, offers, booking │
└──────────────────────────┘               │  • tracking, completion,     │
                                           │    settlement, passbook      │
                                           └──────────────┬───────────────┘
                                                          │ SQLAlchemy
                                                   ┌──────▼──────┐
                                                   │ SQLite file │
                                                   └─────────────┘
```

The job moves through these states: `estimated` → `booked` → `in_progress` →
`awaiting_confirmation` → `completed` (or `disputed`). If the description is too vague, the job
first goes to `needs_information`.

- **FairRate:** the price is built from an illustrative rate card (`backend/app/data/rate_card.json`)
  using trade, complexity, urgency and estimated duration. The rates are illustrative, not official
  market rates or legal wages.
- **Matching:** uses the worker's trade, availability and the haversine distance between the worker
  and the job, within the worker's service radius.
- **Tracking:** the worker's phone posts its position to the backend. The employer's app polls it,
  draws the road route, and estimates arrival at an average city speed of 20 km/h.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Leaflet, lucide-react icons, Mukta font |
| Maps | OpenStreetMap tiles. Road routes come from the public OSRM server, falling back to a straight line. Directions open in Google Maps. No API keys needed. |
| Backend | Python 3.10+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Uvicorn |
| Database | SQLite, a local file created automatically |
| AI (optional) | Claude vision-language model for work orders. The default is an offline rule-based generator. |
| Quality | pytest (259 tests), ruff, ESLint, `tsc` |

## Project structure

```
LaborLink/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # HTTP routes: jobs, workers, marketplace, completion, tracking, images
│   │   ├── services/        # business logic: pricing, matching, offers, bookings, tracking, passbook…
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── data/            # rate_card.json (FairRate configuration)
│   │   ├── models.py        # SQLAlchemy tables
│   │   ├── init_db.py       # creates / upgrades the database
│   │   └── main.py          # FastAPI app
│   ├── tests/               # pytest suite
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── screens/         # onboarding, employer, worker, tracking screens
│   │   ├── components/      # UI kit, live map, swipe button, phone frame helpers
│   │   ├── lib/             # API client, session, road routing, Delhi NCR areas
│   │   ├── page.tsx         # screen router
│   │   └── globals.css      # design tokens and styles
│   ├── next.config.mjs      # proxies /api/v1 to the backend
│   └── package.json
└── docs/                    # architecture, API reference, guides, changelog
```

---

## Getting started

### Prerequisites

| Tool | Version | Check with |
|---|---|---|
| Python | 3.10 or newer | `python --version` |
| Node.js | 18.17 or newer (20 LTS recommended) | `node --version` |
| npm | comes with Node | `npm --version` |
| Git | any | `git --version` |

You need two terminals: one for the backend and one for the frontend.

### 1. Clone the repository

```bash
git clone https://github.com/ravishkansal22/LaborLink.git
cd LaborLink
```

### 2. Set up the backend (terminal 1)

Create and activate a virtual environment in the repository root:

**Windows (PowerShell)**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**macOS / Linux**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

If PowerShell blocks the activation script, run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then try again.

Install the dependencies:

```bash
cd backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Optionally, create a `.env` file. The defaults work without one.

```bash
# Windows: Copy-Item .env.example .env
cp .env.example .env
```

Start the API:

```bash
python -m uvicorn app.main:app --reload
```

On first start the backend creates `backend/var/laborlink.db` and `backend/var/uploads/`. To check
it's running:

- Health check: <http://127.0.0.1:8000/api/v1/health> should return `"status": "ok"`
- Interactive API docs (Swagger UI): <http://127.0.0.1:8000/docs>

Keep this terminal running.

### 3. Set up the frontend (terminal 2)

From the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open **<http://localhost:3000>**. On a desktop the app is shown inside a phone frame.

The frontend sends every `/api/v1/*` request to the backend at `http://127.0.0.1:8000`, so no CORS
setup is needed. If your backend runs elsewhere, set `LABORLINK_API_URL` before starting the
frontend:

```bash
# Windows PowerShell
$env:LABORLINK_API_URL = "http://127.0.0.1:8010"; npm run dev
# macOS / Linux
LABORLINK_API_URL=http://127.0.0.1:8010 npm run dev
```

### 4. Production build (optional)

```bash
cd frontend
npm run build
npm start          # serves the built app on port 3000
```

For the backend, drop `--reload` and add `--host 0.0.0.0` if other devices on your network need to
reach it.

---

## Try the full demo

You can play both sides in one browser. Each tab keeps the role it was opened with, so use one tab
as the employer and another as the worker.

1. **Employer onboarding:** choose a language → **I need work done** → allow or skip permissions →
   enter a name, phone number and area (for example *Saket*).
2. **Post a job:** **Describe a new job** → type or speak something like *"Bedroom fan regulator is
   sparking"* and optionally add a photo → **Get price estimate**. You'll see the work order and
   the FairRate range.
3. **Create a worker:** Profile → **Switch to worker mode** → create a worker with the same trade
   in a nearby area (for example *Lajpat Nagar*, about 5 km from Saket).
4. **Make an offer:** Worker home / Find work → open the job → **Accept ₹…** (the suggested pay), or
   **Counter offer**.
5. **Book:** switch to hiring mode (or use the employer tab) → open the job → **Book**. The live
   tracking screen opens straight away.
6. **Travel:** in the worker tab, open the job → **Start trip to customer**. If the browser blocks
   location, as is common on laptops, tap **Run a demo trip instead**. Watch the employer tab:
   the arrow moves along the road, "Arriving in N min" counts down, and then it shows
   "At your door".
7. **Work:** on the worker's trip screen, **swipe to start the job** → add after (and optionally
   before) photos → **Send for confirmation**.
8. **Confirm & pay:** employer → **Work is done — confirm** (or report a problem) →
   **Pay ₹… (demo)**.
9. **Passbook:** worker → **Passbook** shows the job and the simulated payment.

You can also run the whole flow with the API alone; see
[docs/EXECUTION_GUIDE.md](docs/EXECUTION_GUIDE.md).

---

## Configuration

**Backend:** set these in `backend/.env`. All are optional; see `backend/.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `LABORLINK_DATABASE_URL` | `sqlite:///./var/laborlink.db` | Database location |
| `LABORLINK_UPLOAD_DIR` | `./var/uploads` | Where job and completion photos are stored |
| `LABORLINK_MAX_UPLOAD_BYTES` | `5242880` (5 MB) | Maximum photo size |
| `LABORLINK_RATE_CARD_PATH` | `./app/data/rate_card.json` | FairRate rates and offer limits |
| `LABORLINK_CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Origins allowed to call the API directly |
| `LABORLINK_WORK_ORDER_PROVIDER` | `rule_based` | `rule_based` (offline) or `anthropic` (Claude vision model) |
| `LABORLINK_ANTHROPIC_MODEL` | `claude-opus-5-5` | Model used when the provider is `anthropic` |
| `ANTHROPIC_API_KEY` | (none) | Only needed for the `anthropic` provider. Never commit it. |
| `SARVAM_API_KEY` | (none) | Turns on server speech-to-text with Sarvam AI. Get a key at <https://dashboard.sarvam.ai>. Never commit it. |
| `LABORLINK_SARVAM_STT_MODEL` | (empty) | Sarvam model to use; empty means Sarvam's default |
| `LABORLINK_MAX_AUDIO_BYTES` | `2097152` (2 MB) | Maximum voice-note size |

**Frontend:** set these as environment variables when you start Next.js.

| Variable | Default | Purpose |
|---|---|---|
| `LABORLINK_API_URL` | `http://127.0.0.1:8000` | Backend that `/api/v1/*` is forwarded to |
| `NEXT_DIST_DIR` | `.next` | Build folder. Change it to run a second dev server from the same folder. |

---

## Tests and checks

```bash
# Backend (from backend/, venv active)
python -m pytest
python -m ruff check .

# Frontend (from frontend/)
npm run typecheck
npm run lint
```

The backend tests use a temporary database for each test and never call paid APIs.

## API overview

All routes are under `/api/v1`. Full request and response schemas are in
[docs/API.md](docs/API.md) and at `/docs` on a running server.

| Area | Endpoints |
|---|---|
| Health & images | `GET /health`, `POST /images`, `GET /images/{id}` |
| Speech-to-text | `GET /speech/status`, `POST /speech/transcribe` |
| Jobs | `POST /jobs`, `GET /jobs/{id}` |
| Workers | `POST /workers`, `GET`/`PATCH /workers/{id}`, `GET /workers/{id}/jobs`, `GET /workers/{id}/offers` |
| Marketplace | `GET /jobs/{id}/matches`, `POST`/`GET /jobs/{id}/offers`, `POST /jobs/{id}/bookings`, `GET /jobs/{id}/booking` |
| Live tracking | `POST /jobs/{id}/worker-location`, `GET /jobs/{id}/worker-location?employer_id=` |
| Completion | `POST /jobs/{id}/start`, `POST`/`GET /jobs/{id}/completion-evidence`, `POST /jobs/{id}/completion-confirmation` |
| Settlement & passbook | `POST`/`GET /jobs/{id}/settlement`, `GET /workers/{id}/passbook` |

---

## Limitations

This is a hackathon prototype, and some things are deliberately out of scope:

- **No real payments.** Settlements are simulated records. There is no escrow, bank or UPI
  integration, and the passbook is not used for credit or lending.
- **No authentication.**
  - Employers and workers are identified by IDs stored in the browser.
  - Anyone who knows those IDs can act as that user.
  - There is no identity verification.
- **Pricing is illustrative.** The rate card is example data, not official market rates or legal
  minimum wages.
- **Work orders are rule-based** unless you configure the optional Claude provider. Observations
  from photos are never presented as confirmed facts.
- **Maps use free public services.**
  - The tiles come from OpenStreetMap, and road routes from the OSRM demo server.
  - To get a route, the worker's start point and the job's coordinates are sent to OSRM.
  - These services are fine for a demo, but self-host them or use a paid provider for real use.
  - The ETA assumes 20 km/h and ignores traffic.
- **Live GPS only works in some setups.** It needs `localhost` or HTTPS, plus location permission.
  Use the demo trip when recording on a laptop.
- **Voice input** uses Sarvam AI only when `SARVAM_API_KEY` is set (recordings up to 25 s are sent
  to Sarvam for transcription and not stored). Without a key it needs Chrome or Edge.
- **The demo is set in Delhi NCR**, using a preset list of areas.

## Troubleshooting

| Symptom | Fix |
|---|---|
| The app says it can't reach the server | Make sure the backend is running on port 8000, or set `LABORLINK_API_URL`. |
| `Port 8000 / 3000 is already in use` | Stop the other process, or use `--port 8010` for Uvicorn or `npm run dev -- -p 3005` for Next.js. Point `LABORLINK_API_URL` at the new backend port. |
| `Activate.ps1 cannot be loaded` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| The map is grey or blank | Check your internet connection. Map tiles and routes are loaded online. |
| The worker never appears on the map | Allow location in the browser, or use **Run a demo trip instead**. |
| You want a fresh start | Stop the backend and delete `backend/var/laborlink.db`; it's recreated on the next start. In the browser, clear site data for `localhost:3000`. |

## Documentation

| Document | What's in it |
|---|---|
| [docs/PROJECT_IDEA.html](docs/PROJECT_IDEA.html) | The project idea and features, as a web page |
| [docs/FACILITIES_REQUIRED.html](docs/FACILITIES_REQUIRED.html) | APIs, cloud services and resources used today and needed for launch |
| [docs/CONTRIBUTING.html](docs/CONTRIBUTING.html) | Contributor guide: setup, running the app, feature branches and PRs |
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | Problem, users, features and roadmap |
| [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md) | Modules, data model, FairRate formula, security boundary |
| [docs/API.md](docs/API.md) | Every endpoint with examples |
| [docs/EXECUTION_GUIDE.md](docs/EXECUTION_GUIDE.md) | Detailed run, test and demo instructions |
| [docs/IMPLEMENTATION_PROGRESS.md](docs/IMPLEMENTATION_PROGRESS.md) | What's done, how it was verified, and known gaps |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Change history |

---

Built for the SEWA hackathon. 🛠️
