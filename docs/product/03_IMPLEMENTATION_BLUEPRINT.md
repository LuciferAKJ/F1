# F1 Race Replay — Implementation Blueprint & Execution Plan

**Document Version:** 1.0.0  
**Status:** Approved Engineering Implementation Plan  
**Repository:** `LuciferAKJ/F1` (`C:\Users\adity\Downloads\f1-race-replay-web`)  
**Base Commit:** `3e59762`  

---

## 1. Synthesis of AI Reviews & Technical Decisions

### 1.1 Comparison & Contradiction Matrix

| Dimension | Review 1 (Claude) | Review 2 (Gemini) | Review 3 (Antigravity) | Definitive Blueprint Decision |
| :--- | :--- | :--- | :--- | :--- |
| **Product Focus** | Spectator broadcast first; simplify all UI. | Hybrid spectator + technical telemetry. | Preserve full technical integrity; clean layout. | **Dual-Mode Architecture:** Race View (spectator default) + Pit Wall (advanced analysis). |
| **Replay Architecture** | Suggested lightweight track view. | Proposed 10 Hz chunked burst architecture. | Confirmed PixiJS engine can power both modes directly. | **Single Replay Engine:** Both modes share one PixiJS canvas and Zustand store. Zero engine duplication. |
| **Default Season** | Hardcode 2024. | Hardcode 2024 or 2025. | Flagged 2026 bug caused by `new Date().getFullYear()`. | **Dynamic Season Detection:** Query `/api/sessions/latest-available`. Never hardcode static years. |
| **Data Generation Rate** | Noted 2 FPS feels slow. | Proposed 10 Hz chunks. | Noted current 2 Hz (`0.5s`) vs reference 25 Hz (`0.04s`). | **Benchmarking Plan:** Retain 2 Hz WebSocket stream; benchmark 2 Hz, 10 Hz, and 25 Hz in Phase 5. |
| **Cloud Storage** | Move cache to S3/R2. | Cloudflare R2 object storage. | Noted in-memory LRU + local pickle disk cache. | **Render Disk Verification First:** Verify persistent disk on Render before adding cloud storage. |
| **Camera Follow Zoom** | Suggested fixed zoom. | Suggested fixed 2.5x. | Diagnosed `Math.max(scale, 1.8)` jump & missing exit reset. | **Proportional Zoom & Smooth Exit:** Proportional zoom based on track scale with auto-overview on exit. |

---

## 2. Performance Benchmarking Plan (2 Hz vs. 10 Hz vs. 25 Hz)

To ensure any future data pipeline modification is grounded in empirical measurement rather than hypothesis:

### 2.1 Benchmark Matrix

| Metric | Current 2 Hz (`0.5s`) | Hypothesis 10 Hz (`0.1s`) | Reference 25 Hz (`0.04s`) |
| :--- | :--- | :--- | :--- |
| **Frames per 90-min Race** | 10,800 frames | 54,000 frames | 135,000 frames |
| **Total Driver Data Points** | 216,000 points | 1,080,000 points | 2,700,000 points |
| **Full Replay JSON Size** | ~32 MB | ~160 MB | ~400 MB |
| **WebSocket Bandwidth** | ~6 KB/sec | ~30 KB/sec | ~75 KB/sec |
| **Backend Processing Time** | ~12–18s | Estimated ~45–60s | Estimated ~90–120s |
| **Client Memory Footprint** | ~65 MB | Estimated ~220 MB | Estimated ~550 MB |
| **Visual Smoothness** | 60 FPS (Client Lerp) | 60 FPS (Client Lerp) | 60 FPS (Near-exact) |

### 2.2 Benchmarking Execution Protocol (Phase 5)
1. Run automated benchmarks using Python profiling on a full race session (e.g. 2024 Bahrain Grand Prix).
2. Measure:
   - Python CPU time in `build_replay_frames`.
   - Pickle cache file size on disk.
   - Client WebSocket throughput and heap allocation in Chromium devtools.
   - Perceived tracking accuracy during high-speed chicane maneuvers.
3. Decision Gate: Only increase generated frame frequency if client lerp visual quality is demonstrated to be insufficient AND client/server resource overhead remains within hosting limits.

---

## 3. Phased Implementation Sequence

```
Phase 0: Final Architecture & Blueprint (CURRENT PHASE — Complete)
   │
   ▼
Phase 1: Landing Page & Race/Session Discovery
   │
   ▼
Phase 2: Spectator-First Race View (Using Existing Engine)
   │
   ▼
Phase 3: Optional Pit Wall Experience (Using Shared State)
   │
   ▼
Phase 4: Circuit Sizing, Camera Behavior & Lerp Improvements
   │
   ▼
Phase 5: Data Integrity, Caching & Performance Benchmarks
   │
   ▼
Phase 6: Full Responsive Testing & Final Quality Audit
```

---

### Phase 1 — Landing Page & Race/Session Discovery [COMPLETED — Updated in Phase 1.1]

- **Status:** COMPLETED & VERIFIED
- **Objective:** Transform the homepage from an empty dialog box into a full-bleed, spectator-first landing page with dynamic season discovery, session-specific availability states, and verified metadata integrity.
- **Implemented Files:**
  - `frontend/app/page.tsx`: Full-bleed responsive landing experience preserving user-selected season, session type, and event without hardcoded 2024 Bahrain fallbacks.
  - `frontend/components/landing/LandingHero.tsx`: Spectator hero header with accurate feature pills, season archive jump action, and clearly labeled Demo CTA (`Sample`).
  - `frontend/components/landing/FeaturedRaceCard.tsx`: Highlights verified replays (`REPLAY VERIFIED`), explicit sample demo sessions (`SAMPLE DEMO DATA`), unverified on-demand checks (`Check availability`), and truthful null/error fallback without fabricated metrics.
  - `frontend/components/landing/CircuitPreviewCard.tsx`: Renders normalized SVG circuit geometry only when verified coordinates (`circuit.x`/`y`) exist, or an honest unavailable state with `—` stats.
  - `frontend/components/landing/RecentRoundsGrid.tsx` & `frontend/components/landing/availabilityUtils.ts`: Truthful round status (`available`, `unverified`, `upcoming`, `restricted`, `unavailable`, `unknown`) requiring `status === "available" && hasTelemetry && verified` before enabling replay launch.
  - `frontend/components/landing/SeasonArchiveSelector.tsx`: Interactive season archive (`2018`–present) with search filtering, controlled `R`/`Q`/`S` session selector, per-session verified badges, and on-demand verification actions.
  - `backend/telemetry/cache.py`, `backend/services/availability_service.py`, `backend/api/sessions.py`, `backend/models/schemas.py`: Removed the 2024 season cap, honoured configured `FASTF1_CACHE_DIR`, validated cached `ProcessedSession` objects against official schedules, exposed `GET /api/sessions/{year}/{event}/{session_type}/availability?verify=false|true`, and returned explicit `Demo Grand Prix` fallback when no verified real session exists.
  - `frontend/types/api.ts`, `frontend/lib/apiClient.ts`, `frontend/hooks/useSeasonEvents.ts`: Added `AbortController` timeouts, session-type query parameters, `checkSessionAvailability`, and `useVerifySessionAvailability` cache updates.
  - `frontend/e2e/race-selector.spec.ts`: Playwright E2E tests and responsive screenshot capture (`1440×900`, `768×1024`, `390×844`).
- **Verification Results (Phase 1.1):**
  - `tsc --noEmit`: 0 errors.
  - `next lint`: Clean, 0 warnings, 0 errors.
  - `vitest`: 20 test files passed, 94 unit/integration tests passed.
  - `pytest`: 55 backend tests passed, 0 failures.
  - `next build`: Static generation of landing page succeeded (`41.6 kB`, `166 kB` First Load JS).
  - `playwright`: 4/4 landing page tests passed with desktop, tablet, and mobile overflow and screenshot verification.
- **Risks & Rollback:**
  - *Risk:* Upstream FastF1 / Jolpica schedule latency on uncached seasons or on-demand `?verify=true` lookups.
  - *Mitigation:* Cache schedule responses (`staleTime: 1 hour`), use fast non-blocking disk cache inspection by default, and isolate verification behind explicit user action with `AbortController` timeouts.
  - *Rollback:* Explicit sample demo replay (`/replay/demo`) remains available independently of upstream APIs.

---

### Phase 2 — Spectator-First Race View

- **Objective:** Build the default "Race View" where the circuit is the hero, flanked by a floating broadcast timing tower, driver battle HUD, and simplified transport.
- **Existing Files Involved:**
  - `frontend/components/layout/MainDashboard.tsx`
  - `frontend/components/layout/Navbar.tsx`
  - `frontend/components/layout/CenterReplay.tsx`
  - `frontend/components/layout/BottomControls.tsx`
  - `frontend/store/replayStore.ts`
- **New Files to Create:**
  - `frontend/components/spectator/SpectatorTimingTower.tsx`
  - `frontend/components/spectator/DriverSpotlightHud.tsx`
  - `frontend/components/spectator/VerifiedMomentsPill.tsx`
- **Dependencies:** Phase 1 (shares route parameter conventions).
- **Data Contract:**
  - Reuses existing `ReplayMetadataDTO` and WebSocket stream.
  - Adds `viewMode: "race" | "pitwall"` to `replayStore.ts` (default: `"race"`).
- **Tests & Acceptance Criteria:**
  - Circuit canvas occupies 80%+ of desktop viewport in Race View.
  - Floating timing tower displays Top 10 with Top 20 expander.
  - Clicking a driver displays minimal spectator spotlight card (Position, Code, Team, Speed).
  - Mode toggle switch in header smoothly switches between Race View and Pit Wall with zero canvas reload.
- **Risks & Rollback:**
  - *Risk:* Canvas resizing during mode toggle causing flicker.
  - *Mitigation:* Use CSS visibility / layout transitions; do not remount `<ReplayCanvas />`.

---

### Phase 3 — Optional Pit Wall Experience

- **Objective:** Retain the advanced engineering workstation (cockpit telemetry, shift lights, dials, and analytics workbench) behind the single-click mode toggle.
- **Existing Files Involved:**
  - `frontend/components/layout/LeftSidebar.tsx`
  - `frontend/components/layout/RightSidebar.tsx`
  - `frontend/components/leaderboard/TimingLadder.tsx`
  - `frontend/components/telemetry/TelemetryPanel.tsx`
  - `frontend/components/analytics/AnalyticsDashboard.tsx`
- **New Files to Create:** None (re-architects existing workstation components into Pit Wall mode).
- **Dependencies:** Phase 2 (coexists with Race View under `viewMode`).
- **Data Contract:** Identical data contracts; consumed from shared Zustand store.
- **Tests & Acceptance Criteria:**
  - Selecting "Pit Wall" in header instantly reveals Left Timing Ladder, Right Telemetry Deck, and Bottom Analytics Workbench.
  - Playback position, selected driver, and camera target remain 100% synchronized when toggling between modes.
  - Unit tests in `AnalyticsWorkbench.test.tsx`, `TelemetryPanel.test.tsx`, and `TimingLadder.test.tsx` continue to pass.
- **Risks & Rollback:**
  - *Risk:* State drift between modes.
  - *Mitigation:* Single Zustand store acts as the sole source of truth.

---

### Phase 4 — Circuit Sizing, Camera Behavior & Replay Interpolation

- **Objective:** Eliminate visual voids for elongated tracks, implement proportional follow-driver zoom, and ensure smooth return-to-overview transitions.
- **Existing Files Involved:**
  - `frontend/lib/pixi/CameraController.ts`
  - `frontend/lib/pixi/TrackLayer.ts`
  - `frontend/lib/pixi/PixiReplayEngine.ts`
  - `frontend/lib/pixi/CarSprite.ts`
- **New Files to Create:** None.
- **Dependencies:** Phase 2 & 3.
- **Data Contract:** Internal PixiJS coordinate mathematics.
- **Tests & Acceptance Criteria:**
  - Elongated tracks (e.g. Spa, Monza) occupy 70%+ of vertical canvas height without aspect-ratio distortion.
  - Entering follow-driver mode applies proportional zoom (`overviewScale * 2.2`) keeping adjacent racing cars in frame.
  - Exiting follow mode smoothly eases camera back to overview scale and position.
  - Car heading rotation and position interpolation remain smooth at 60 FPS across all playback speeds ($0.5\times$ to $4\times$).
- **Risks & Rollback:**
  - *Risk:* Breaking isometric scale.
  - *Mitigation:* Strictly enforce `world.scale.x === world.scale.y`.

---

### Phase 5 — Data Integrity, Caching & Performance Benchmarks

- **Objective:** Benchmark 2 Hz vs. 10 Hz vs. 25 Hz generated timeline, verify Render persistent disk configuration, and refine availability disclosures.
- **Existing Files Involved:**
  - `backend/telemetry/processor.py`
  - `backend/telemetry/pipeline.py`
  - `backend/telemetry/cache.py`
  - `backend/config.py`
- **New Files to Create:**
  - `backend/scripts/benchmark_frame_intervals.py`
  - `docs/benchmarks/frame_frequency_analysis.md`
- **Dependencies:** Phases 1–4.
- **Data Contract:** Benchmarking test scripts; no breaking API changes unless justified by benchmark findings.
- **Tests & Acceptance Criteria:**
  - Empirical report documenting memory, bandwidth, and CPU load across 2 Hz, 10 Hz, and 25 Hz.
  - Render persistent disk mount confirmed and documented.
  - Zero data fabrication; genuine status disclosures.
- **Risks & Rollback:**
  - *Risk:* High memory consumption on increased frame rates.
  - *Mitigation:* Run benchmarks in isolated script; keep `FRAME_INTERVAL_S = 0.5` as default until approved.

---

### Phase 6 — Full Responsive Testing & Quality Gates

- **Objective:** Comprehensive multi-device visual regression audit and end-to-end user journey validation across desktop and mobile.
- **Existing Files Involved:**
  - `frontend/e2e/responsive-ux.spec.ts`
  - `frontend/e2e/demo-replay.spec.ts`
- **New Files to Create:**
  - `frontend/e2e/dual-mode-replay.spec.ts`
- **Dependencies:** All preceding phases.
- **Tests & Acceptance Criteria:**
  - Playwright tests pass across all 9 target viewports (320px to 1920px) with zero horizontal overflow.
  - All unit tests (Vitest) and backend tests (pytest) pass.
  - Production build (`npm run build`) compiles cleanly.
- **Risks & Rollback:**
  - Fix any discovered visual regressions atomically.

---

## 4. Git & Pull Request Strategy

To maintain strict repository safety:

1. **Branching Model:**
   - Base branch: `main` (commit `3e59762`).
   - Feature branches: `feat/landing-page-discovery` (Phase 1), `feat/spectator-race-view` (Phase 2), etc.
2. **Commit Conventions:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `perf:`).
3. **Atomic Execution:** Each phase is executed on an isolated branch, validated against complete quality gates, and submitted as an atomic Pull Request.
4. **Safety Rules:**
   - Never use `git add .` or `git add -A`.
   - Untracked root `node_modules/` must remain untouched.
   - Zero force-pushes or history rewriting.

---

## 5. Immediate Next Step & Pre-Execution Verification

### The First Implementation Phase to Execute:
👉 **PHASE 1: Landing Page & Race/Session Discovery**

### What Must Be Verified Before Phase 1 Begins:
1. **Branch Verification:** Confirm active branch is branched cleanly from `main` (`3e59762`).
2. **Quality Gate Baseline:** Run `npx tsc --noEmit` and `npm run lint` to confirm a 100% clean baseline.
3. **Backend Health Check:** Verify production backend health endpoint (`GET https://f1-race-replay-api.onrender.com/api/health`) returns `{"status":"ok"}`.
4. **Schedule Contract Verification:** Confirm `GET /api/sessions/2024/events` and `GET /api/sessions/2026/events` payload structures before implementing the discovery UI.

