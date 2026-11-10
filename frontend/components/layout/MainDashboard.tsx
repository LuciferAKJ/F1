"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Flag, ListOrdered, Activity, BarChart2 } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import { useReplayMetadata } from "@/hooks/useReplayMetadata";
import { useReplayWebSocket } from "@/hooks/useReplayWebSocket";
import { useReplayFrameAt } from "@/hooks/useReplayFrameAt";
import { useRaceIntelligence } from "@/hooks/useRaceIntelligence";
import { usePreferences } from "@/hooks/usePreferences";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Navbar } from "@/components/layout/Navbar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { CenterReplay } from "@/components/layout/CenterReplay";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { BottomControls } from "@/components/layout/BottomControls";
import { TimingLadder } from "@/components/leaderboard/TimingLadder";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Dynamic import for the unified analytics workbench
const AnalyticsDashboard = dynamic(
  () => import("@/components/analytics/AnalyticsDashboard").then((m) => m.AnalyticsDashboard),
  { ssr: false, loading: () => <Skeleton className="h-12 w-full" /> }
);

interface MainDashboardProps {
  race: SelectedRace;
}

type MobileTab = "track" | "timing" | "telemetry" | "analytics";

export function MainDashboard({ race }: MainDashboardProps) {
  const setSelectedRace = useReplayStore((s) => s.setSelectedRace);
  const selectedRace = useReplayStore((s) => s.selectedRace);
  const playing = useReplayStore((s) => s.playing);
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);
  const metadata = useReplayStore((s) => s.metadata);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const playbackSpeed = useReplayStore((s) => s.playbackSpeed);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);
  const setSpeed = useReplayStore((s) => s.setSpeed);
  const setWsControls = useReplayStore((s) => s.setWsControls);

  const { preferences, setPreference } = usePreferences();
  const restoredDriverRef = useRef(false);

  // Responsive mode: viewports < 1024px switch to adaptive mobile-first layout
  const isMobileLayout = useMediaQuery("(max-width: 1023px)");
  const [mobileTab, setMobileTab] = useState<MobileTab>("track");

  // Stable reference to the active race configuration to prevent redundant hook cycles
  const activeRace = useMemo(
    () => ({ year: race.year, event: race.event, sessionType: race.sessionType }),
    [race.year, race.event, race.sessionType]
  );

  // Register the requested race on mount / when it changes.
  useEffect(() => {
    setSelectedRace(activeRace);
    restoredDriverRef.current = false;
  }, [activeRace, setSelectedRace]);

  useReplayMetadata(activeRace);
  const ws = useReplayWebSocket(activeRace);
  // While paused, fetch the exact frame for the scrub position (play mode gets frames from the WS stream).
  useReplayFrameAt(activeRace, currentTimestamp, !playing);
  // Computed once per loaded replay (memoized) and shared by the timeline markers + intelligence panel below.
  const { intelligence, isLoading: intelligenceLoading } = useRaceIntelligence(activeRace);

  // Publish the WebSocket's seek function to the store
  useEffect(() => {
    setWsControls({ seek: ws.seek });
    return () => setWsControls(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.seek]);

  // Restore the last-selected driver (once metadata/drivers are available) and playback speed.
  useEffect(() => {
    if (!restoredDriverRef.current && metadata && preferences.lastSelectedDriver) {
      const exists = metadata.drivers.some((d) => d.abbreviation === preferences.lastSelectedDriver);
      if (exists) setSelectedDriver(preferences.lastSelectedDriver);
      restoredDriverRef.current = true;
    }
  }, [metadata, preferences.lastSelectedDriver, setSelectedDriver]);

  useEffect(() => {
    if (preferences.playbackSpeed && preferences.playbackSpeed !== 1) setSpeed(preferences.playbackSpeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist driver/speed selection as the user changes them.
  useEffect(() => {
    if (selectedDriver) setPreference("lastSelectedDriver", selectedDriver);
  }, [selectedDriver, setPreference]);

  useEffect(() => {
    setPreference("playbackSpeed", playbackSpeed);
  }, [playbackSpeed, setPreference]);

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-screen animate-fade-in flex-col overflow-hidden bg-pitwall-canvas text-pitwall-text font-body select-none">
      <Navbar />

      {/* =====================================================================
          DESKTOP WORKSTATION LAYOUT (>= 1024px)
         ===================================================================== */}
      {!isMobileLayout ? (
        <>
          <div className="flex flex-1 min-h-0 w-full overflow-hidden flex-row">
            <LeftSidebar />
            <CenterReplay />
            <RightSidebar />
          </div>
          <div className="max-h-[38vh] shrink-0 overflow-y-auto bg-pitwall-dock border-t border-pitwall-hairline px-3 py-1.5">
            <AnalyticsDashboard
              race={selectedRace}
              onSeek={ws.seek}
              intelligence={intelligence}
              isLoadingIntelligence={intelligenceLoading}
            />
          </div>
        </>
      ) : (
        /* =====================================================================
            MOBILE & TABLET COMPANION LAYOUT (< 1024px)
           ===================================================================== */
        <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden relative">
          {/* Main View Area: Track Canvas stays mounted for performance & camera sync */}
          <div className={cn("flex-1 min-h-0 w-full relative", mobileTab === "track" ? "flex" : "hidden")}>
            <CenterReplay />
          </div>

          {/* Timing Ladder Mobile View */}
          {mobileTab === "timing" && (
            <div className="flex-1 min-h-0 w-full overflow-y-auto p-2 bg-pitwall-dock">
              <div className="max-w-md mx-auto h-full flex flex-col">
                <TimingLadder />
              </div>
            </div>
          )}

          {/* Telemetry Mobile View */}
          {mobileTab === "telemetry" && (
            <div className="flex-1 min-h-0 w-full overflow-y-auto p-2 bg-pitwall-dock">
              <div className="max-w-md mx-auto">
                <TelemetryPanel />
              </div>
            </div>
          )}

          {/* Analytics Mobile View */}
          {mobileTab === "analytics" && (
            <div className="flex-1 min-h-0 w-full overflow-y-auto p-2 bg-pitwall-dock">
              <div className="max-w-2xl mx-auto">
                <AnalyticsDashboard
                  race={selectedRace}
                  onSeek={ws.seek}
                  intelligence={intelligence}
                  isLoadingIntelligence={intelligenceLoading}
                />
              </div>
            </div>
          )}

          {/* Mobile Bottom Navigation Switcher */}
          <nav
            aria-label="Mobile replay navigation"
            className="flex items-center justify-around h-11 shrink-0 bg-pitwall-surface border-t border-pitwall-hairline px-2 z-20"
          >
            <button
              onClick={() => setMobileTab("track")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded text-xs font-display font-bold uppercase tracking-wider transition-colors",
                mobileTab === "track"
                  ? "text-pitwall-telemetry bg-pitwall-elevated shadow-xs"
                  : "text-pitwall-text-muted hover:text-white"
              )}
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Track</span>
            </button>

            <button
              onClick={() => setMobileTab("timing")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded text-xs font-display font-bold uppercase tracking-wider transition-colors",
                mobileTab === "timing"
                  ? "text-pitwall-telemetry bg-pitwall-elevated shadow-xs"
                  : "text-pitwall-text-muted hover:text-white"
              )}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Timing</span>
            </button>

            <button
              onClick={() => setMobileTab("telemetry")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded text-xs font-display font-bold uppercase tracking-wider transition-colors",
                mobileTab === "telemetry"
                  ? "text-pitwall-telemetry bg-pitwall-elevated shadow-xs"
                  : "text-pitwall-text-muted hover:text-white"
              )}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Telemetry</span>
            </button>

            <button
              onClick={() => setMobileTab("analytics")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded text-xs font-display font-bold uppercase tracking-wider transition-colors",
                mobileTab === "analytics"
                  ? "text-pitwall-telemetry bg-pitwall-elevated shadow-xs"
                  : "text-pitwall-text-muted hover:text-white"
              )}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Analytics</span>
            </button>
          </nav>
        </div>
      )}

      {/* Shared Playback Controls (Always visible and synced across all views) */}
      <BottomControls onSeek={ws.seek} intelligence={intelligence} />
    </div>
  );
}
