# Production Deployment & Public Launch Guide

This document specifies the production deployment architecture, step-by-step platform setup, environment configuration, storage strategy, and verification checklist for **F1 Race Replay**.

---

## 1. Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │                 Browser                 │
                      └───────────────┬─────────────────┬───────┘
                                      │                 │
                           HTTPS REST │                 │ WSS WebSocket
                                      ▼                 ▼
             ┌─────────────────────────────┐   ┌─────────────────────────────┐
             │       Vercel (Frontend)     │   │      Railway (Backend)      │
             │     Next.js 15 App Router   │   │       FastAPI + Uvicorn     │
             │   Static Assets & SSR Shell │   │   REST API + WebSocket Live │
             └─────────────────────────────┘   └──────────────┬──────────────┘
                                                              │
                                            ┌─────────────────┴─────────────────┐
                                            │ FastF1 Cache & Telemetry Storage  │
                                            │  - Raw Sessions Cache (Disk)      │
                                            │  - Processed Replay Pickles       │
                                            │  - Optional Persistent Volume     │
                                            └───────────────────────────────────┘
```

- **Frontend**: Next.js 15 (React 19, TypeScript, TailwindCSS, PixiJS, Lucide React, Recharts) hosted on **Vercel**.
- **Backend**: FastAPI (Python 3.11, Uvicorn, FastF1, Pandas, NumPy, Pydantic, WebSockets, orjson) running as a Docker container on **Railway** (or Render).
- **Protocol Security**: All production traffic uses `HTTPS` for REST and `WSS` for WebSockets.

---

## 2. Frontend Configuration (Vercel)

### 2.1 Project Settings
- **Repository**: `https://github.com/LuciferAKJ/F1`
- **Root Directory**: `frontend`
- **Framework Preset**: `Next.js`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm ci`

### 2.2 Environment Variables (Vercel)
| Variable | Required | Example Value | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | **Yes** | `https://f1-race-replay-production.up.railway.app` | Public HTTPS URL of the deployed FastAPI backend. |
| `NEXT_PUBLIC_WS_URL` | Optional | `wss://f1-race-replay-production.up.railway.app` | Explicit WSS WebSocket URL (defaults to deriving from `NEXT_PUBLIC_API_URL`). |

---

## 3. Backend Configuration (Railway)

### 3.1 Project Settings
- **Repository**: `https://github.com/LuciferAKJ/F1`
- **Root Directory**: `backend` (or Root with Dockerfile path `backend/Dockerfile`)
- **Builder**: `Dockerfile`
- **Port**: Dynamically assigned via `$PORT` (defaults to `8000`)
- **Health Check Path**: `/api/health`
- **Health Check Timeout**: `30s`

### 3.2 Environment Variables (Railway)
| Variable | Required | Example Value | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | Auto | `8000` | Injected automatically by Railway. |
| `FRONTEND_ORIGIN` | **Yes** | `https://f1-race-replay.vercel.app` | The public URL of the Vercel frontend for CORS validation. |
| `CORS_ORIGINS` | Optional | `https://f1-race-replay.vercel.app,http://localhost:3000` | Comma-separated list of allowed origins. |
| `FASTF1_CACHE_DIR` | Optional | `/app/assets/cache` | Path for FastF1 and preprocessed telemetry pickles. |
| `REDIS_URL` | Optional | `redis://localhost:6379/0` | Optional Redis cache (system functions statelessly without Redis). |

### 3.3 Storage / Volume Configuration
- FastF1 downloads and caches session data on disk.
- To retain FastF1 data across backend restarts/re-deployments, attach a Railway Persistent Volume mounted to `/app/assets/cache` (or mount path set in `FASTF1_CACHE_DIR`).
- If running without a persistent disk, cache will be ephemeral and re-downloaded on cold container starts upon session request.

---

## 4. WebSocket & Proxy Configuration

- Railway and Vercel natively support WebSocket connections.
- WebSocket endpoint: `/ws/replay/{year}/{event}/{session_type}`
- Protocol negotiation:
  - Frontend automatically transforms `https://...` to `wss://...` via `apiClient.ts`.
  - FastAPI WebSocket router accepts connections, sends metadata payload, streams 60 FPS interpolated frames, and handles client control commands (`speed`, `seek`, `pause`, `play`).

---

## 5. Deployment Verification & Smoke Test Checklist

### 5.1 Backend Smoke Tests
- [ ] `GET /api/health` returns `{"status": "ok"}`
- [ ] `GET /api/sessions/2024/events` returns list of season events
- [ ] `GET /api/replay/2024/Bahrain/R/metadata` returns duration, frame count, drivers, circuit coordinates
- [ ] `WSS /ws/replay/2024/Bahrain/R` connects, receives metadata, and streams frame data

### 5.2 Frontend Smoke Tests
- [ ] Homepage opens over HTTPS without mixed-content warnings
- [ ] Race selector loads years (2023, 2024, 2025) and session lists
- [ ] Navigating to `/replay/2024/Bahrain/R` mounts PixiJS canvas
- [ ] Cars and track render accurately
- [ ] Controls work: Play, Pause, Speed adjustment (0.5x, 1x, 2x, 4x), Timeline scrubbing/seek
- [ ] Telemetry charts (Speed, Throttle, Brake, RPM, Gear, DRS) update synchronously
- [ ] Race Intelligence panel displays overtakes, pit stops, and position changes
- [ ] Race Insights displays sector performance and analysis cards
- [ ] No CORS errors in browser DevTools Console
- [ ] No unauthorized localhost fallback requests in production

---

## 6. Troubleshooting & Rollbacks

- **CORS Error**: Check `FRONTEND_ORIGIN` on Railway. Ensure protocol (`https://`) matches exactly and has no trailing slash.
- **WebSocket 400/502**: Ensure Railway service domain is public and proxies WebSocket headers (`Upgrade: websocket`).
- **Cold Start Delay**: The first request for a non-cached session downloads FastF1 telemetry (~10–25 seconds). Subsequent requests use the local pickle cache (<100ms).
- **Rollback**:
  - Vercel: Instantly promote the previous successful deployment in the Vercel Dashboard.
  - Railway: Rollback to the previous deployment via Railway Deployment history.
