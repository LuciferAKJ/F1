# F1 Race Replay

[![Frontend CI](https://github.com/your-username/f1-race-replay-web/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/f1-race-replay-web/actions/workflows/ci.yml)
[![Backend CI](https://github.com/your-username/f1-race-replay-web/actions/workflows/backend.yml/badge.svg)](https://github.com/your-username/f1-race-replay-web/actions/workflows/backend.yml)
[![E2E Tests](https://github.com/your-username/f1-race-replay-web/actions/workflows/e2e.yml/badge.svg)](https://github.com/your-username/f1-race-replay-web/actions/workflows/e2e.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg)](https://www.python.org/)

An interactive Formula 1 race replay and telemetry analysis dashboard, built on
real session data from [FastF1](https://github.com/theOehrly/Fast-F1). Pick any
season, Grand Prix, and session, then replay the race with a PixiJS-rendered
track, an F1 TV-style live timing tower, a broadcast-style telemetry dashboard,
synchronized analytics charts, and derived race intelligence (overtakes,
fastest laps, position history).

> This is a portfolio/personal project, not affiliated with Formula 1, FIA, or
> any team. All telemetry is sourced from the public FastF1 API.

---

## Screenshots

<!-- Replace with real captures once you have a session loaded locally. -->
`docs/screenshots/replay-overview.png` — full dashboard (track + timing tower + telemetry)
`docs/screenshots/analytics.png` — telemetry analytics charts with comparison mode
`docs/screenshots/race-intelligence.png` — event feed + position history + bookmarks

`docs/gifs/replay-playback.gif` — replay playing at 2x with the timing tower updating
`docs/gifs/command-palette.gif` — Cmd/Ctrl+K quick actions

---

## Feature List

**Replay & Rendering**
- PixiJS-rendered circuit (racing line, start/finish line, approximate sector markers)
- All drivers animated as team-colored cars with driver number, abbreviation label, and heading-based rotation
- Smooth 60 FPS interpolation between backend frames (~0.5s interval)
- Zoom, pan, follow-driver camera mode, auto-fit-to-circuit, animated reset
- Play/pause, 1x/2x/4x speed, timeline scrub, jump-to-lap, jump-to-timestamp
- WebSocket-streamed playback with play/pause/seek/speed control from the server

**Timing & Telemetry**
- F1 TV-style live timing tower: position, driver, team, lap, tyre, DRS, live sector position, position-change arrows, estimated tyre age, estimated last-lap time, fastest-lap badge
- Broadcast-style telemetry dashboard for the selected driver: animated speed/RPM gauges, gear indicator, throttle/brake bars, DRS pill, tyre badge, sector/lap/position badges

**Analytics**
- Synchronized Speed / Throttle / Brake / RPM / Gear charts (Recharts), with a shared zoom brush, click-to-seek, drag-to-scrub, and a replay cursor
- Two-driver comparison overlay using each driver's real team color
- CSV export of a driver's telemetry series

**Race Intelligence**
- Overtake detection (clean 1-for-1 position swaps between consecutive frames)
- Fastest-lap detection (derived from observed lap-transition timestamps)
- Position-history chart per driver
- Scrolling event feed synced to replay time, with clickable timeline markers
- Bookmarks (name, jump, delete) — persisted in `localStorage`, no backend
- JSON export of bookmarks and detected race events

**Production / UX**
- Command palette (Cmd/Ctrl+K): play/pause, restart, driver select, compact/comparison toggles, jump to bookmark
- Toast notifications, skeleton loading states, route-level error boundaries, global error boundary, 404 page
- Collapsible sidebars, compact mode, keyboard shortcuts (Space, ←/→), ARIA labels and focus-visible styling throughout
- User preferences (compact mode, last driver, playback speed, comparison mode, sidebar collapse) persisted in `localStorage`
- Dynamic imports for the PixiJS canvas and the Analytics/Race-Intelligence panels — see [Performance Notes](#performance-notes)

**What's intentionally *not* faked**
Everywhere the pipeline lacks real data, the UI says so instead of inventing
numbers: gap-to-leader, interval-to-car-ahead, pit status, per-sector
personal-best coloring, full driver names, pit-lane geometry, DRS-zone
geometry, ERS deployment, pit-limiter status, and Safety Car/VSC/flag states
are all either hidden, shown as explicitly-disabled, or (for tyre age and lap
times) labeled as client-side estimates with their precision caveats spelled
out in tooltips and component doc-comments.

---

## Architecture

```
+-------------------------+        REST (JSON, gzip)        +--------------------------+
|                         | -------------------------------> |                          |
|   Next.js 15 Frontend   |   /api/sessions/{year}/events    |   FastAPI Backend        |
|   (React 19, TS)        |   /api/replay/.../metadata       |                          |
|                         |   /api/replay/.../frame/{t}      |  +--------------------+  |
|  +-------------------+  | <------------------------------- |  | services/          |  |
|  | Zustand store     |  |                                  |  |  fastf1_service    |  |
|  | (replay state)    |  |        WebSocket (live frames)   |  |  session_overview  |  |
|  +-------------------+  | <-------------------------------->  +--------------------+  |
|  +-------------------+  |   /ws/replay/{year}/{event}/{s}  |  +--------------------+  |
|  | PixiJS engine     |  |   play / pause / seek / speed    |  | telemetry/          |  |
|  | (track + cars +   |  |                                  |  |  loader -> processor|  |
|  |  camera)          |  |                                  |  |  -> cache -> pipeline| |
|  +-------------------+  |                                  |  +--------------------+  |
|  React Query (caching)  |                                  |           |              |
+-------------------------+                                  |           v              |
                                                               |   FastF1 (session load, |
                                                               |   full-race telemetry)  |
                                                               +--------------------------+
```

Data flow: the backend loads a FastF1 session once (disk-cached by FastF1
itself), extracts full-race per-driver telemetry, interpolates it onto a
shared ~0.5s time grid, computes leaderboard position per frame, and caches
the processed result to disk (`telemetry/cache.py`). The frontend fetches
circuit/driver metadata once, then either streams frames over the WebSocket
during playback or fetches individual/filtered frames over REST while
scrubbing. All heavier analysis (race intelligence, per-driver analytics
series) is fetched once via the existing REST endpoint and memoized — never
recomputed per animation frame.

---

## Folder Structure

```
f1-race-replay-web/
├── backend/
│   ├── api/                  # FastAPI routers: sessions, replay (REST), ws_replay (WebSocket)
│   ├── services/             # FastF1 session loading/caching, shared session-overview extraction
│   ├── telemetry/            # loader -> processor -> cache -> pipeline, plus query filters
│   ├── models/schemas.py     # Pydantic response models (camelCase JSON via alias generator)
│   ├── config.py             # Settings (cache dir, Redis URL, CORS)
│   └── main.py               # App entry: CORS, GZip, ORJSON, router registration
│
└── frontend/
    ├── app/                  # Next.js App Router: race selector, /replay/[year]/[event]/[session],
    │                         #   error/global-error/not-found, loading skeleton
    ├── components/
    │   ├── layout/           # MainDashboard, sidebars, bottom controls, error fallback
    │   ├── track/             # ReplayCanvas (mounts the PixiJS engine)
    │   ├── leaderboard/       # Live timing tower
    │   ├── telemetry/         # Broadcast-style telemetry dashboard
    │   ├── analytics/         # Synchronized Recharts telemetry charts + comparison mode
    │   ├── timeline/          # Race intelligence: event feed, position history, bookmarks, markers
    │   ├── command/           # Command palette
    │   └── ui/                # shadcn-style primitives (button, select, slider, skeleton, toasts)
    ├── lib/
    │   ├── pixi/              # TrackLayer, CarSprite, CameraController, PixiReplayEngine
    │   ├── apiClient.ts       # Typed REST client
    │   ├── replayAdapter.ts   # Backend frame shape -> engine frame shape
    │   ├── raceIntelligence.ts # Pure overtake/fastest-lap/position-history analysis
    │   └── exportUtils.ts     # JSON/CSV download helpers
    ├── hooks/                 # React Query hooks, WebSocket hook, preferences, bookmarks
    ├── store/                 # Zustand replay store + toast store
    └── types/                 # Shared TS contracts (API DTOs, internal replay types)
```

---

## Installation

**Prerequisites:** Python 3.11+, Node.js 20+, npm.

```bash
git clone <this-repo>
cd f1-race-replay-web
```

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # adjust if needed
uvicorn main:app --reload
```
Backend runs at `http://localhost:8000`. First request for a given
year/event/session downloads and caches FastF1 data (`backend/assets/cache/`)
— subsequent loads are fast.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # adjust NEXT_PUBLIC_API_BASE_URL if needed
npm run dev
```
Frontend runs at `http://localhost:3000`.

---

## Environment Variables

**Backend (`backend/.env`)**

| Variable | Default | Description |
|---|---|---|
| `FASTF1_CACHE_DIR` | `./assets/cache` | Where FastF1 caches raw session data |
| `REDIS_URL` | `redis://localhost:6379/0` | Reserved for optional Redis caching (not required to run) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |

**Frontend (`frontend/.env.local`)**

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend base URL (REST + derived WS URL) |

---

## Development

```bash
# Backend
cd backend && uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend && npm run dev

# Type-check
cd frontend && npx tsc --noEmit

# Lint
cd frontend && npm run lint
```

## Testing

### Frontend Tests (Vitest & React Testing Library)
Run all unit and component tests:
```bash
cd frontend
npm run test
# For watch mode:
npm run test:watch
# For coverage report:
npm run test:coverage
```

### End-to-End Tests (Playwright)
Run the full browser end-to-end test suite:
```bash
cd frontend
npm run e2e
# For interactive UI mode:
npm run e2e:ui
```

### Backend Tests (pytest)
Run unit and integration tests with coverage:
```bash
cd backend
pytest
```

---

## Docker Support

### Production (Docker Compose)
Build and run both the Next.js standalone frontend and FastAPI backend:
```bash
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

### Development with Hot Reload
```bash
docker compose -f docker-compose.dev.yml up --build
```

---

## Build

```bash
cd frontend && npm run build && npm run start
```

Backend has no separate "build" step — deploy with `uvicorn main:app` (or
behind `gunicorn -k uvicorn.workers.UvicornWorker` in production) plus a
persistent volume for `assets/cache/`.

---

## API Overview

| Endpoint | Description |
|---|---|
| `GET /api/health` | Liveness check |
| `GET /api/sessions/{year}/events` | Season schedule (round, event name, country, date) |
| `GET /api/sessions/{year}/{event}/{session}` | Session detail: drivers, circuit map, race-time bounds |
| `GET /api/replay/{year}/{event}/{session}` | Full or filtered replay frames — query params: `start_time`, `end_time`, `lap`, `driver` |
| `GET /api/replay/{year}/{event}/{session}/metadata` | Drivers, teams/colors, total laps, duration, circuit, frame interval/count (no frame payload) |
| `GET /api/replay/{year}/{event}/{session}/frame/{timestamp}` | Nearest single frame at a given race-time |
| `WS /ws/replay/{year}/{event}/{session}` | Streams frames; accepts `{action: "play"\|"pause"\|"seek"\|"speed", ...}` |

All JSON responses use camelCase keys (Pydantic `alias_generator`) and are
gzip-compressed by `GZipMiddleware` above ~1KB.

---

## Performance Notes

- **Dynamic imports / code splitting:** the PixiJS canvas and the Analytics /
  Race-Intelligence panels are loaded via `next/dynamic({ ssr: false })` with
  skeleton fallbacks. This measurably shrank the replay route's First Load JS
  from ~412 kB to ~179 kB, since `pixi.js` and `recharts` are deferred into
  their own async chunks instead of blocking the initial page.
- **Memoized analysis:** race intelligence (`analyzeRace`) and per-driver
  analytics series both run inside `useMemo`/React Query caches keyed on the
  fetched dataset — computed once per loaded replay, never per animation frame.
- **Decoupled render loops:** the PixiJS engine runs its own `ticker`
  (independent RAF loop) for 60 FPS car/camera interpolation; React state
  updates (from WebSocket frames, ~2/s during playback) never drive that
  loop, so chart/leaderboard re-renders can't stall replay smoothness. The
  ticker also pauses via `visibilitychange` when the tab is inactive.
- **Row-level memoization:** leaderboard rows and telemetry gauges are
  individually `memo`'d on primitive props, so a value that hasn't changed
  between frames (gear, tyre, lap, position) skips re-rendering even though
  the parent frame object itself is a new reference every tick.

---

## Future Roadmap

- Real gap-to-leader / interval-to-car-ahead (needs a proper time-behind-leader
  algorithm using per-point track distance, which isn't in the current payload)
- Pit-lane and DRS-zone geometry on the track (needs that geometry from FastF1
  wired through the backend — not currently extracted)
- Lap Delta, Sector Comparison, Tyre Strategy, and Pit Stop Timeline analytics
  (need official lap/sector times and pit in/out events from the backend)
- Weather panel wired to real data (currently a graceful "unavailable" state —
  the desktop prototype has this; the web pipeline doesn't yet)
- A real light theme (currently dark-only by design; the preference key exists
  for forward compatibility but nothing switches on it yet)
- Redis-backed replay-frame caching for multi-instance deployments (env var
  already present; not yet wired up)

---

## Contributing & Community

Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting issues or pull requests.
For security concerns, please refer to our [Security Policy](SECURITY.md).

---

## License

Distributed under the [MIT License](LICENSE).
FastF1 data usage is subject to FastF1's own terms and FIA Formula 1 guidelines.
