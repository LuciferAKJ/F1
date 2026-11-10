# F1 Race Replay — Architecture, Wireframes & Technical Specifications

**Document Version:** 1.0.0  
**Status:** Approved Architectural Blueprint  
**Repository:** `LuciferAKJ/F1`  

---

## 1. Page and Route Hierarchy

```
/ (Landing Page & Discovery)
│
├── /replay/demo (Offline Instant Procedural Demo)
│
└── /replay/[year]/[event]/[session] (Live Session Replay)
      ├── Mode: Race View (Default Spectator Layout)
      └── Mode: Pit Wall (Advanced Telemetry & Analytics Layout)
```

---

## 2. Desktop and Mobile Wireframe Specifications

### 2.1 Landing Page (`/`) — Desktop Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [F1 LOGO] F1 RACE REPLAY           [Season: 2024 ▼]  [Try Demo Button]  [GitHub] │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   HERO TITLE: FORMULA 1 REPLAY REIMAGINED                                        │
│   Subtitle: Cinema-grade 2D circuit tracking with synchronized telemetry.        │
│                                                                                  │
│   ┌─────────────────────────────────────┐  ┌─────────────────────────────────┐   │
│   │ 🏁 FEATURED RACE                   │  │ 🗺️ CIRCUIT PREVIEW              │   │
│   │ Round 24 — Abu Dhabi Grand Prix     │  │                                 │   │
│   │ Yas Marina Circuit · 58 Laps        │  │         ╭───────╮               │   │
│   │ Status: ● FULL TELEMETRY AVAILABLE  │  │        ╱         ╲              │   │
│   │                                     │  │       │     🏎️    │             │   │
│   │ [  ▶ LAUNCH FULL RACE REPLAY  ]     │  │        ╲         ╱              │   │
│   │ [  ⚡ TRY INSTANT DEMO REPLAY ]     │  │         ╰───────╯               │   │
│   └─────────────────────────────────────┘  └─────────────────────────────────┘   │
│                                                                                  │
│   RECENT COMPLETED ROUNDS                                                        │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌───────────┐   │
│   │ Rd 23: Qatar GP │  │ Rd 22: Vegas GP │  │ Rd 21: São Paulo│  │ Rd 20: MX │   │
│   │ ● Full Telemetry│  │ ● Full Telemetry│  │ ● Full Telemetry│  │ ● Full Tel│   │
│   │ [ Watch Replay ]│  │ [ Watch Replay ]│  │ [ Watch Replay ]│  │ [ Watch ] │   │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘  └───────────┘   │
│                                                                                  │
│   HISTORICAL ARCHIVE SELECTOR                                                    │
│   Select Season: [ 2024 ▼ ]   Grand Prix: [ Select GP ▼ ]   Session: [ Race ▼ ] │
│   Availability Notice: "Showing verified sessions with available telemetry."     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Replay — Desktop "Race View" (Default Spectator Mode)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [F1] MONACO GP · LAP 24/78   TIME: 00:32:14.500   [🏁 Race View | 🛠️ Pit Wall]   │
├───────────────────┬──────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ │                                                              │
│ │ TIMING (TOP10)│ │                                                              │
│ ├───────────────┤ │                       CIRCUIT REPLAY                         │
│ │01 VER  M  14L │ │                (Commands 85%+ Screen Space)                  │
│ │02 NOR  M  14L │ │                                                              │
│ │03 LEC  H  24L │ │                       ╭───────────╮                          │
│ │04 PIA  M  14L │ │                      ╱             ╲                         │
│ │05 SAI  H  24L │ │                     ╱   🏎️ VER     ╲                         │
│ │06 HAM  S   8L │ │                    │    🏎️ NOR       │                        │
│ │07 RUS  M  14L │ │                    │                 │                       │
│ │08 PER  H  24L │ │                     ╲               ╱                        │
│ │09 ALO  M  14L │ │                      ╰─────────────╯                         │
│ │10 TSU  H  24L │ │                                                              │
│ ├───────────────┤ │                                                              │
│ │[+ Show All 20]│ │                                                              │
│ └───────────────┘ │  ┌────────────────────────────────┐  ┌─────────────────────┐ │
│                   │  │ DRIVER SPOTLIGHT: 1 VER        │  │ [🔍+] [🔍-] [RESET]  │ │
│                   │  │ Red Bull Racing · P1 · S2 · 284│  │ [🎯 FOLLOW DRIVER]   │ │
│                   │  └────────────────────────────────┘  └─────────────────────┘ │
├───────────────────┴──────────────────────────────────────────────────────────────┤
│ [▶] [⏮] [⏭] [1x ▼]  00:32:14.500  ━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━  01:42:15.000 │
│ Scrubber Markers:                 ▲ FL (VER)   ▲ OT (NOR)                        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Replay — Desktop "Pit Wall" (Optional Advanced Mode)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [F1] MONACO GP · LAP 24/78   TIME: 00:32:14.500   [🏁 Race View | 🛠️ Pit Wall]   │
├───────────────┬───────────────────────────────────────────────┬──────────────────┤
│ 20-CAR TIMING │                CENTER CIRCUIT                 │  TELEMETRY DECK  │
│ LADDER        │                                               │ • Rev Limiter Bar│
│ • Full Splits │                                               │ • Speed/RPM Dials│
│ • Tyre Stints │                                               │ • Gear & DRS Box │
│ • Delta Track │                                               │ • Throttle/Brake │
│ • Weather Row │                                               │ • Rolling Traces │
├───────────────┴───────────────────────────────────────────────┴──────────────────┤
│ COLLAPSIBLE ANALYTICS WORKBENCH                                                   │
│ [ TRACES ]  [ LAP COMPARISON ]  [ RACE CONTROL LOG ]  [ STRATEGY STINTS ]         │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [▶] [⏮] [⏭] [1x ▼]  00:32:14.500  ━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━  01:42:15.000 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Mobile Replay Wireframe (<1024px)

```
┌────────────────────────────────────────┐
│ [F1] MONACO GP · L24/78   [⚙️ Mode ▼]  │
├────────────────────────────────────────┤
│                                        │
│          FULL-WIDTH CIRCUIT            │
│            CANVAS (100%)               │
│                                        │
│               🏎️ VER                   │
│               🏎️ NOR                   │
│                                        │
│ [🔍 Reset]              [🎯 Follow VER]│
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ 🏎️ #1 VER · P1 · 284 km/h · Lap 24 │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ [▶] 00:32:14  ━━━━●━━━━━━━━━  01:42:15 │
├────────────────────────────────────────┤
│  [🏁 Track]  [📋 Timing]  [📊 Tel]     │
└────────────────────────────────────────┘
```

---

## 3. Component Architecture

```
frontend/
├── app/
│   ├── page.tsx                          # Full-bleed landing page & race discovery
│   ├── replay/
│   │   ├── demo/page.tsx                 # Offline demo route
│   │   └── [year]/[event]/[session]/     # Dynamic replay route
│   │       └── page.tsx
├── components/
│   ├── landing/                          # NEW: Landing page components
│   │   ├── LandingHero.tsx               # Hero header and primary CTA
│   │   ├── FeaturedRaceCard.tsx          # Latest verified race card
│   │   ├── RecentRoundsGrid.tsx          # Recent completed GP cards
│   │   ├── CircuitPreviewCard.tsx        # Vector circuit preview
│   │   └── SeasonArchiveSelector.tsx     # Historical season/session finder
│   ├── layout/
│   │   ├── MainDashboard.tsx             # Dual-mode shell coordinator
│   │   ├── Navbar.tsx                    # Command header with Mode Switcher
│   │   ├── CenterReplay.tsx              # Canvas wrapper & floating HUDs
│   │   ├── LeftSidebar.tsx               # Pit Wall left dock wrapper
│   │   ├── RightSidebar.tsx              # Pit Wall right dock wrapper
│   │   └── BottomControls.tsx            # Transport scrubber and event chips
│   ├── spectator/                        # NEW: Spectator-first components
│   │   ├── SpectatorTimingTower.tsx      # Floating Top-10 / Top-20 leaderboard
│   │   ├── DriverSpotlightHud.tsx        # Minimal spectator driver card
│   │   └── VerifiedMomentsPill.tsx       # Overtake/Fastest-lap notification
│   ├── leaderboard/
│   │   └── TimingLadder.tsx              # Pit Wall 20-car engineering tower
│   ├── telemetry/
│   │   └── TelemetryPanel.tsx            # Pit Wall telemetry workstation
│   ├── analytics/
│   │   └── AnalyticsDashboard.tsx        # Pit Wall multi-tab workbench
│   └── track/
│       └── ReplayCanvas.tsx              # Shared WebGL PixiJS canvas
├── store/
│   └── replayStore.ts                    # Single source of truth (Zustand)
└── lib/
    └── pixi/                             # WebGL simulation engine (Pixi.js)
        ├── PixiReplayEngine.ts
        ├── TrackLayer.ts
        ├── CarSprite.ts
        └── CameraController.ts
```

---

## 4. Backend & Data Architecture

### 4.1 Data Flow Pipeline

```
FastF1 Live Timing Archive (Upstream Jolpica / Ergast / FastF1)
                           │
                           ▼
          backend/services/fastf1_service.py
                           │
                           ▼
          backend/telemetry/pipeline.py
       (Single-flight session lock via _session_locks)
                           │
                           ▼
          backend/telemetry/loader.py
     (Extracts X, Y, Speed, Gear, Throttle, Brake, RPM, DRS, Tyre, Lap, Sector)
                           │
                           ▼
          backend/telemetry/processor.py
     (Interpolates onto FRAME_INTERVAL_S = 0.5s grid -> 2 Hz)
                           │
                           ▼
          backend/telemetry/cache.py
   (Multi-tier: In-memory LRU [max=1] + Disk Pickle Cache)
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
   HTTP REST Endpoints           WebSocket Stream
   /api/replay/.../metadata      /ws/replay/{year}/{event}/{session}
   /api/sessions/.../events      (2 Hz frames: ~3 KB / frame)
```

---

## 5. API & Session-Availability Requirements

### 5.1 Dynamic Availability Discovery Endpoint

To solve the empty 2026 dropdown bug, the backend will expose a session discovery schema distinguishing **Calendar Schedule** from **Telemetry Availability**:

```typescript
// GET /api/sessions/{year}/events
interface SeasonEventDTO {
  roundNumber: number;
  eventName: string;
  country: string;
  location: string;
  eventDate: string;
  // Availability metadata
  hasTelemetry: boolean;       // True if timing/telemetry data is verified in cache/FastF1
  status: "available" | "upcoming" | "restricted";
  availableSessions: string[]; // e.g. ["R", "Q", "FP1"]
}
```

### 5.2 Latest Completed Session Endpoint

```typescript
// GET /api/sessions/latest-available
interface LatestAvailableSessionDTO {
  year: number;
  event: string;
  sessionType: string;
  roundNumber: number;
  eventName: string;
  totalLaps: number;
  duration: number;
}
```

The landing page queries `/api/sessions/latest-available` on load to automatically configure the featured race card and preselect the default dropdown, eliminating static year hardcoding.

---

## 6. Circuit & Camera Specification

### 6.1 Aspect-Ratio Conscious Auto-Fit

To eliminate massive empty voids on elongated tracks (e.g. Spa, Monza) without distorting geometry:

```typescript
// CameraController.ts: Aspect-Ratio Adaptive Scaling
const screenAspect = screenW / screenH;
const trackAspect = this.worldWidth / this.worldHeight;

// Isometric scaling (strictly equal X and Y scale to preserve true geometry)
const fitScale = Math.min(screenW / this.worldWidth, screenH / this.worldHeight) * FIT_MARGIN;

// Center of Mass visual centering (offset visual bounding box rather than raw min/max)
this.targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale));
this.targetX = screenW / 2;
this.targetY = screenH / 2;
```

### 6.2 Proportional Follow-Driver Camera

```typescript
// Follow zoom is proportional to track scale rather than arbitrary 1.8 constant
followDriver(abbr: string): void {
  this.mode = "follow";
  this.followAbbr = abbr;
  // Provide 2.2x magnification relative to overview scale, capped safely
  const proportionalFollowScale = Math.min(MAX_SCALE, Math.max(this.overviewScale * 2.2, 1.2));
  this.targetScale = proportionalFollowScale;
  this.onFollowChange?.(abbr);
}

// Exit follow smoothly returns to calculated overview
stopFollowing(): void {
  this.mode = "free";
  this.followAbbr = null;
  this.targetScale = this.overviewScale;
  this.targetX = this.overviewX;
  this.targetY = this.overviewY;
  this.onFollowChange?.(null);
}
```

