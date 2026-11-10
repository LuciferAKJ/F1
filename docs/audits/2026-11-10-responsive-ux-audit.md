# F1 Race Replay — Product, UI/UX, Responsive & Functional Audit Report

**Date**: November 10, 2026  
**Repository**: `LuciferAKJ/F1` (`C:\Users\adity\Downloads\f1-race-replay-web`)  
**Base Commit**: `f53d8fb` (Merge pull request #4 from LuciferAKJ/feat/stitch-ui-redesign)  
**Branch**: `fix/responsive-ux-audit`  
**Auditor**: Antigravity AI Engineering & UX Review  
**Status**: **COMPLETED & VERIFIED (PASS)**

---

## 1. Executive Summary

Formula 1 Race Replay has completed a comprehensive product, UI/UX, responsive, and functional audit.

The application was previously heavily optimized for an ultra-dense desktop pit-wall workstation with a rigid three-column layout (`w-64` + `Center` + `w-72`), which broke completely on mobile viewports (<768px), crushed the track replay canvas, starved vertical space via a default-expanded `38vh` analytics dashboard, and suffered from marker collision on the timeline event rail. Additionally, the desktop interface suffered from "card soup"—nested boxes inside sidebars with redundant developer headers and micro-labels.

Through this audit and targeted architectural refactoring, the application now delivers a **clean, modern, premium F1 race companion with a strong circuit replay experience, accessible telemetry, and intuitive playback controls** across all device profiles:
- **Mobile (<1024px)**: Single-column, mobile-first companion with a dedicated 4-tab switcher (`Track`, `Timing`, `Telemetry`, `Analytics`), full-width circuit canvas, touch-friendly transport bar, and zero horizontal scrolling.
- **Desktop (>=1024px)**: Refined, airy workstation layout with unified sidebar docks, seamless instrument panels without nested card borders, quiet DRS indicators, integrated collapse controls, and maximum circuit prominence.
- **Timeline Clustering**: Overlapping overtakes and fastest laps are clustered into clean, readable multi-event chips that expand on hover/tap.
- **WebSocket Reconnection & State Sync**: Reconnections read directly from the live Zustand store (`useReplayStore.getState()`) to guarantee zero stale closure state on reconnect. Reconnects are strictly bounded by both consecutive retries (`MAX_RECONNECT_ATTEMPTS = 3`) and session total limits (`MAX_TOTAL_RECONNECT_ATTEMPTS = 5`), with a 5000ms stability gate preventing rapid flapping loops from retrying indefinitely.
- **Keyboard Navigation Protection**: Form controls, dropdowns, and search dialogs are protected from intercepting global replay shortcut triggers.

---

## 2. Issues Discovered, Classified & Resolved

| Issue ID | Severity | Component | Problem Description | Resolution & Fix Applied | Status |
|---|---|---|---|---|---|
| **AUDIT-01** | **Critical** | `MainDashboard.tsx`, `LeftSidebar.tsx`, `RightSidebar.tsx` | Rigid 3-column flex layout (544px minimum fixed sidebar widths) crushed circuit to 0px on mobile viewports (<768px). | Refactored architecture using `useMediaQuery`: On viewports <1024px, renders mobile-first companion with 4-tab switcher (`Track`, `Timing`, `Telemetry`, `Analytics`). Circuit canvas stays mounted across tab switches. | **RESOLVED** |
| **AUDIT-02** | **High** | `MainDashboard.tsx`, `AnalyticsDashboard.tsx` | Fixed `max-h-[38vh]` analytics container defaulted to expanded, consuming over 50% of vertical height on mobile. | Embedded analytics into dedicated mobile tab; enhanced tab headers with responsive labels (`TRACES`, `LAPS`, `EVENTS`, `STRATEGY`) and horizontal scroll safety. | **RESOLVED** |
| **AUDIT-03** | **High** | `BottomControls.tsx` | Overlapping overtakes and fastest lap markers stacked on top of each other at identical percentages on the timeline scrubber rail. | Implemented intelligent event clustering (<2.0% timeline delta grouped into numbered badges with tooltip breakdown and seek targeting). | **RESOLVED** |
| **AUDIT-04** | **Medium** | `BottomControls.tsx` | Global keyboard shortcuts fired while interacting with selects, comboboxes, and search dialogs. | Broadened focus guard to check `isContentEditable`, `SELECT`, and closest `[role="combobox"]`, `[role="dialog"]`, `[role="listbox"]`. Added non-element safe guards. | **RESOLVED** |
| **AUDIT-05** | **High** | `useReplayWebSocket.ts` | Immediate retry counter reset on `onopen` permitted infinite reconnect chattering on flapping connections; stale closures synchronized outdated playback values; unhandled payloads risked parse failures. | Synchronized latest live store state (`useReplayStore.getState()`), added stability duration delay (5s) before resetting consecutive retry counter, enforced dual bounds (max 3 consecutive, max 5 total), and added regression test suite. | **RESOLVED** |
| **AUDIT-06** | **Medium** | `MainDashboard.tsx`, `app/page.tsx` | `h-screen` caused bottom playback controls to be pushed beneath mobile browser address bars. | Replaced with dynamic viewport height `h-[100dvh] min-h-[100dvh] max-h-[100dvh]`. | **RESOLVED** |
| **AUDIT-07** | **Medium** | `LeftSidebar.tsx`, `RightSidebar.tsx`, `TimingLadder.tsx`, `TelemetryPanel.tsx` | Desktop interface suffered from excessive nested card borders, redundant developer titles ("Pit-Wall Left Dock"), noisy 20-row inactive DRS boxes, duplicate "PIPELINE: BOOLEAN STATE" labels, and crowded vertical space. | Removed double-card wrappers; integrated collapse controls into primary headers; simplified DRS column to only illuminate when active; combined cockpit meters into unified surfaces with cleaner visual hierarchy; gave the circuit center stage. | **RESOLVED** |
| **AUDIT-08** | **Low** | `CenterReplay.tsx`, `Navbar.tsx` | Top-left HUD card and top-right camera controls collided on mobile portrait viewports; duplicate "DEMO DATA" badges. | Compacted HUD card to minimal top-left pill; sized camera controls with 36px touch targets; removed redundant badge duplicates. | **RESOLVED** |
| **AUDIT-09** | **Medium** | `BottomControls.tsx` | 4px scrubber track was too narrow for touch dragging on mobile devices. | Added touch-friendly hit area (`h-5 py-1` with centered progress bar) for responsive seeking. | **RESOLVED** |
| **AUDIT-10** | **Low** | `app/page.tsx` | Homepage "Try Demo" button navigated to `/replay/0/Demo%20Grand%20Prix/R` instead of canonical `/replay/demo`. | Standardized URL routing to `/replay/demo` across all links and buttons. | **RESOLVED** |

---

## 3. Multi-Viewport Responsive Verification Matrix

All 9 target viewports were tested using Playwright headless execution in Chromium with WebGL SwiftShader emulation. Zero horizontal scroll overflow was confirmed across all tested resolutions (`scrollWidth === clientWidth`):

| Viewport Name | Dimensions | Device Profile | Layout Mode | Horizontal Overflow | Screenshot Artifact |
|---|---|---|---|---|---|
| `mobile_320x640` | 320 × 640 | Compact Mobile (SE) | Mobile Tab Companion | **NONE (PASS)** | `docs/screenshots/mobile_320x640.png` |
| `mobile_360x800` | 360 × 800 | Standard Android | Mobile Tab Companion | **NONE (PASS)** | `docs/screenshots/mobile_360x800.png` |
| `mobile_390x844` | 390 × 844 | iPhone 14 / Modern Smartphone | Mobile Tab Companion | **NONE (PASS)** | `docs/screenshots/mobile_390x844.png` |
| `mobile_430x932` | 430 × 932 | Large iPhone Pro Max | Mobile Tab Companion | **NONE (PASS)** | `docs/screenshots/mobile_430x932.png` |
| `tablet_768x1024` | 768 × 1024 | iPad Portrait | Mobile Tab Companion | **NONE (PASS)** | `docs/screenshots/tablet_768x1024.png` |
| `compact_1024x768` | 1024 × 768 | iPad Landscape / Small Desktop | 3-Column Workstation | **NONE (PASS)** | `docs/screenshots/compact_1024x768.png` |
| `laptop_1366x768` | 1366 × 768 | 14" Laptop Screen | 3-Column Workstation | **NONE (PASS)** | `docs/screenshots/laptop_1366x768.png` |
| `desktop_1440x900` | 1440 × 900 | Standard Desktop Display | 3-Column Workstation | **NONE (PASS)** | `docs/screenshots/desktop_1440x900.png` |
| `pitwall_1920x1080` | 1920 × 1080 | Full HD Pit-Wall Workstation | 3-Column Workstation | **NONE (PASS)** | `docs/screenshots/pitwall_1920x1080.png` |

---

## 4. Test Verification Summary

| Test Suite | Scope | Target | Result | Duration | Notes |
|---|---|---|---|---|---|
| **TypeScript** | Typecheck | `npx tsc --noEmit` | **PASS (0)** | ~12s | 0 type errors across all specs, hooks, and components. |
| **ESLint** | Code Quality | `npm run lint` | **PASS (0)** | ~8s | 0 warnings or errors. |
| **Vitest** | Unit & Component | `npx vitest run` | **PASS (0)** | ~25s | **18/18 test files passed, 80/80 tests passed** (including WebSocket reconnect & state sync tests). |
| **Next.js Build** | Production Build | `npm run build` | **PASS (0)** | ~12s | Production build compiled cleanly; static pages generated. |
| **Playwright E2E** | End-to-End Suite | `CI=true npx playwright test` | **PASS (0)** | ~95s | **17/17 tests passed** (including all 9 responsive viewports). |
| **Backend Pytest** | FastF1 API & Replay | `cd backend; pytest` | **PASS (0)** | ~19s | **49/49 passed**, session overview & deduplication verified. |

---

## 5. Modified Files & Clean Architecture

1. `frontend/hooks/useMediaQuery.ts` *(New)*: SSR-safe media query hook using React 18/19 `useSyncExternalStore`.
2. `frontend/hooks/useReplayWebSocket.ts`: Reconnect backoff with 5s stability window, bounded retry caps (consecutive & total), safe JSON parsing, and fresh store state dispatch.
3. `frontend/hooks/__tests__/useReplayWebSocket.test.ts` *(New)*: Comprehensive unit tests for initial state sync, reconnect state freshness, stability reset, and bounded retries.
4. `frontend/components/layout/MainDashboard.tsx`: Adaptive layout switching between Desktop 3-column dock (>=1024px) and Mobile companion (<1024px) with dynamic `100dvh` height.
5. `frontend/components/layout/LeftSidebar.tsx`: Unified timing dock, seamless header with integrated collapse button, and sleek compact weather strip.
6. `frontend/components/layout/RightSidebar.tsx`: Clean telemetry dock with integrated collapse toggle and removed outer card padding.
7. `frontend/components/leaderboard/TimingLadder.tsx`: Cleaned nested borders, quiet DRS column, streamlined row hover styling, and data honesty footer.
8. `frontend/components/telemetry/TelemetryPanel.tsx`: Removed card soup (7 nested boxes replaced with unified cockpit instrument cluster), streamlined throttle/brake meters, and compact transparency disclosure.
9. `frontend/components/layout/BottomControls.tsx`: Timeline marker clustering (<2.0% delta), touch hit-box expansion, keyboard focus protection, and responsive mobile transport formatting.
10. `frontend/components/layout/Navbar.tsx`: Responsive header formatting, title truncation, and removal of duplicate tags.
11. `frontend/components/layout/CenterReplay.tsx`: Compact circuit HUD, safe overlay positioning, and 36px touch targets.
12. `frontend/components/analytics/AnalyticsDashboard.tsx`: Responsive tab short labels (`TRACES`, `LAPS`, `EVENTS`, `STRATEGY`) and horizontal overflow safety.
13. `frontend/app/page.tsx`: Standardized demo navigation link to canonical `/replay/demo`.
14. `frontend/vitest.config.ts`: Configured `pool: "forks"` for fast, reliable unit test execution on Windows.
15. `frontend/e2e/responsive-ux.spec.ts` *(New)*: Comprehensive 9-viewport regression test suite asserting zero horizontal overflow and full-page screenshot capture.

---

## 6. Known Limitations

- **Historical Session Weather**: FastF1 per-frame weather stream remains desktop-pipeline-only; the web UI gracefully displays an informative "Track Weather · OFFLINE" status.
- **Unsupported Pipeline Channels**: ERS battery harvest/deploy percentage, steering angle, and longitudinal/lateral G-forces remain unavailable in the upstream FastF1 stream; they are explicitly disclosed as `N/A` without synthetic fabrication.
