# F1 Race Replay — Final Product Requirements Document (PRD)

**Document Version:** 1.0.0  
**Status:** Approved Architectural Blueprint  
**Repository:** `LuciferAKJ/F1` (`https://github.com/LuciferAKJ/F1`)  
**Base Commit:** `3e59762`  
**Reference Benchmark:** `https://github.com/IAmTomShaw/f1-race-replay`  

---

## 1. Executive Summary & Product Vision

**F1 Race Replay** is an interactive, browser-based Formula 1 race visualization platform that bridges the gap between casual motorsport spectators and technical telemetry enthusiasts.

Historically, the application evolved as an engineering workstation ("Pit Wall") packed with dense dials, raw telemetry channels, and nested technical cards. While information-dense, this intimidated casual fans, overwhelmed mobile screens, and starved the circuit visualization of screen real estate.

This PRD establishes the **Definitive Product Direction**:
A unified **Dual-Mode Experience** running on a **single, shared WebGL simulation engine**:
1. **Race View (Default Spectator Mode):** Full-bleed, cinema-grade circuit visualization where the track is the main attraction, supported by a clean broadcast-style timing tower, simple playback transport, driver spotlight HUD, and verified session moments.
2. **Pit Wall (Optional Engineering Mode):** High-density telemetry workstation providing cockpit dials, 15-LED shift array, linear throttle/brake meters, rolling synchronized telemetry traces, multi-car lap comparison, and strategy workbench.

Both modes consume the **exact same replay timeline, the same Zustand store, and the same WebSocket data stream**. Switching modes is an instant UI layout transition that **never unmounts the PixiJS canvas or resets playback state**.

---

## 2. Synthesis & Resolution of Independent AI Reviews

| Architectural Topic | Claude Review | Gemini Review | Antigravity Audit | Final Engineering Decision |
| :--- | :--- | :--- | :--- | :--- |
| **Default Season** | Proposed hardcoding 2024. | Suggested hardcoding 2024 or 2025. | Flagged `new Date().getFullYear()` (2026) loading un-run sessions. | **Dynamic Season Detection:** Query backend for latest completed season with verified telemetry. Never hardcode static years. |
| **2026 Session Availability** | Claimed 2026 is totally unavailable. | Suggested removing 2026 from dropdown. | Confirmed schedule API returns 23 rounds; telemetry 404s on un-run races. | **Schedule vs. Telemetry Distinction:** Distinguish calendar discovery from telemetry availability. Label sessions with status pills (`Available`, `Upcoming`, `Restricted`). |
| **Frame Interval & Pipeline** | Noted 2 FPS feels coarse. | Proposed 10 Hz chunked streaming architecture. | Documented `FRAME_INTERVAL_S = 0.5` (2 Hz) vs. reference 25 Hz. | **Phased Benchmark Plan:** Gemini's 10 Hz chunk model is an unverified hypothesis. Retain current 2 Hz WebSocket stream and benchmark 2 Hz, 10 Hz, and 25 Hz in Phase 5 before changing backend contracts. |
| **Storage & Caching** | Suggested AWS S3 / R2 for static caches. | Proposed moving cache to external cloud object store. | Documented in-memory LRU (`max=1`) + local pickle cache. | **Render Disk Verification First:** Render supports persistent disks. Verify whether a persistent volume is mounted to `FASTF1_CACHE_DIR`. Do not introduce AWS/R2 complexity without a measured requirement. |
| **Circuit Geometry & Scale** | Flagged small track appearance. | Suggested aggressive auto-zoom. | Identified `coordScale` normalization & `FIT_MARGIN` 0.88 aspect-ratio void. | **Aspect-Ratio Conscious Auto-Fit:** Preserve 1:1 isometric scale (`world.scale.x === world.scale.y`). Dynamically adjust padding based on track aspect ratio. Never distort track geometry. |
| **Camera Transitions** | Flagged abrupt zoom jump. | Proposed fixed 2.5x camera follow. | Identified `Math.max(scale, 1.8)` jump and missing exit reset. | **Proportional Camera Follow & Smooth Exit:** Proportional zoom based on track scale. Automatically and smoothly return to overview when follow mode is exited. |
| **Data Honesty** | Advised against mock telemetry. | Emphasized broadcast look. | Disclosed FastF1 pipeline boundaries (ERS, wear, G-force unavailable). | **Strict Non-Fabrication:** Never fabricate synthetic gaps, tyre wear, or ERS. Missing channels are disclosed or omitted cleanly. |

---

## 3. User Personas & Core Journeys

### Persona A: "The Grand Prix Fan" (Casual / Spectator)
- **Goal:** Relive a recent race, watch overtakes, see where their favorite driver was on track, and understand the race order.
- **Pain Points:** Intimidated by RPM dials, ERS percentages, and confusing engineering controls. Wants a clear map, driver positions, and simple play/pause.
- **Primary Mode:** **Race View (Default)**.

### Persona B: "The Strategy & Telemetry Analyst" (Technical Fan)
- **Goal:** Compare throttle traces into Turn 1, analyze apex speeds, verify when DRS was opened, and inspect stint tyre degradation.
- **Pain Points:** Frustrated by oversimplified interfaces that hide telemetry traces, sector splits, or raw metrics.
- **Primary Mode:** **Pit Wall (Single-Click Toggle)**.

---

## 4. Functional Requirements

### 4.1 Homepage & Race Discovery (`/`)
1. **Full-Bleed Hero Section:** Modern Formula 1 visual presentation replacing the 448px isolated modal card.
2. **Instant Demo Launch:** Dedicated 1-click launchpad into `/replay/demo` with zero network latency.
3. **Dynamic Season & Event Selection:**
   - Dropdown queries available calendar seasons dynamically.
   - Automatically preselects the latest completed Grand Prix with verified telemetry.
   - Displays clear session status badges (`Full Telemetry Available`, `Upcoming Session`, `Timing Only`).
4. **Interactive Circuit Preview:** Visual track ribbon and circuit metadata displayed on the landing page prior to launching the replay.
5. **Historical Archive Access:** Clean navigation to historical seasons (2018–present) with honest data availability disclosures.

### 4.2 Replay Experience (`/replay/...`)

#### Race View (Default Spectator Mode)
1. **Prominent Circuit Replay:** Track canvas commands 80%+ of viewport real estate.
2. **Floating Broadcast Timing Tower:**
   - Left-dock floating overlay with semi-transparent backdrop.
   - Displays Top 10 by default with expandable Top 20 toggle.
   - Information hierarchy: Position (P1–P20), Position delta ($\blacktriangle/\blacktriangledown$), Constructor color ribbon, Driver abbreviation, Tyre compound chip, Stint age (`est.`), and active DRS pill.
3. **Driver Battle HUD:**
   - Clicking a driver displays an unobtrusive bottom-left spectator card (Driver Code, Number, Team, Speed, Live Sector, Follow button).
4. **Streamlined Transport Controls:**
   - Bottom floating bar with Play/Pause, Scrubber rail, Lap progress (`Lap X / Total`), Race elapsed time, and Playback speed selector ($0.5\times$, $1\times$, $2\times$, $4\times$).
   - Verified event chips on timeline (Overtakes, Fastest Laps) with hover tooltip and click-to-seek.

#### Pit Wall (Advanced Telemetry Mode)
1. **3-Column Pit Wall Workstation:** Activated via top command deck switch `[ 🏁 Race View | 🛠️ Pit Wall ]`.
2. **Full Timing Ladder:** All 20 cars with detailed sector splits and micro-headers.
3. **Cockpit Telemetry Deck:**
   - Shift Lights: 15-LED RPM rev limiter array.
   - Analog Speed & RPM dials with peak speed tracker.
   - Tactical Gear block with active DRS status indicator.
   - Linear Throttle bar ($0\text{--}100\%$) and binary Brake indicator.
   - Real synchronized rolling telemetry traces.
   - Transparent unsupported channel chips (`ERS`, `Pit Limiter`, `Tyre Wear`, `G-Force`).
4. **Interactive Analytics Workbench:**
   - Collapsible 4-view drawer: Telemetry Traces, Lap Comparison, Race Control Log, and Strategy Timeline.

---

## 5. Non-Functional & Reliability Requirements

1. **Zero Canvas Unmounting:** Switching between Race View and Pit Wall MUST toggle UI visibility via CSS layout classes (`hidden` / `flex` / overlays) without unmounting `<ReplayCanvas />` or destroying the WebGL context.
2. **Responsive Zero-Overflow:** Zero horizontal scrolling across all viewports from 320px to 1920px (`scrollWidth === clientWidth`).
3. **Dynamic Viewport Height:** Strict usage of `100dvh` across all layout containers to prevent mobile address bar clipping.
4. **Data Honesty & Authenticity:** No synthetic fabrication of gaps, intervals, pit stops, or ERS channels for real sessions.
5. **Bounded Reconnection:** WebSocket client maintains a 5-second stability window and dual retry limits (max 3 consecutive, max 5 total).

