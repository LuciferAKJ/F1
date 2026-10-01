"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import { useReplayMetadata } from "@/hooks/useReplayMetadata";
import { useReplayWebSocket } from "@/hooks/useReplayWebSocket";
import { useReplayFrameAt } from "@/hooks/useReplayFrameAt";
import { useRaceIntelligence } from "@/hooks/useRaceIntelligence";
import { usePreferences } from "@/hooks/usePreferences";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { CenterReplay } from "@/components/layout/CenterReplay";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { BottomControls } from "@/components/layout/BottomControls";
import { TimelineMarkers } from "@/components/timeline/TimelineMarkers";
import { Skeleton } from "@/components/ui/skeleton";

// Both panels pull in Recharts and start collapsed — deferring their code
// (and the heavy analysis hook's first render) off the initial bundle.
const AnalyticsDashboard = dynamic(
  () => import("@/components/analytics/AnalyticsDashboard").then((m) => m.AnalyticsDashboard),
  { ssr: false, loading: () => <Skeleton className="h-12 w-full" /> }
);
const RaceIntelligencePanel = dynamic(
  () => import("@/components/timeline/RaceIntelligencePanel").then((m) => m.RaceIntelligencePanel),
  { ssr: false, loading: () => <Skeleton className="h-12 w-full" /> }
);
const RaceInsightsPanel = dynamic(
  () => import("@/components/insights/RaceInsightsPanel").then((m) => m.RaceInsightsPanel),
  { ssr: false, loading: () => <Skeleton className="h-12 w-full" /> }
);

interface MainDashboardProps {
  race: SelectedRace;
}

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

  // Register the requested race on mount / when it changes.
  useEffect(() => {
    setSelectedRace(race);
    restoredDriverRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.year, race.event, race.sessionType]);

  useReplayMetadata(selectedRace);
  const ws = useReplayWebSocket(selectedRace);
  // While paused, fetch the exact frame for the scrub position (play mode gets frames from the WS stream).
  useReplayFrameAt(selectedRace, currentTimestamp, !playing);
  // Computed once per loaded replay (memoized) and shared by the timeline markers + intelligence panel below.
  const { intelligence, isLoading: intelligenceLoading } = useRaceIntelligence(selectedRace);

  // Publish the WebSocket's seek function to the store (mirrors the existing pixiControls
  // pattern) so global UI like the command palette can seek without prop-drilling.
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
    <div className="flex h-screen w-screen animate-fade-in flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <CenterReplay />
        <RightSidebar />
      </div>
      <div className="max-h-[45vh] shrink-0 overflow-y-auto px-3 pt-2">
        <div className="flex flex-col gap-3">
          <AnalyticsDashboard race={selectedRace} onSeek={ws.seek} />
          <RaceIntelligencePanel
            race={selectedRace}
            intelligence={intelligence}
            isLoading={intelligenceLoading}
            onSeek={ws.seek}
          />
          <RaceInsightsPanel race={selectedRace} intelligence={intelligence} onSeek={ws.seek} />
        </div>
      </div>
      <TimelineMarkers intelligence={intelligence} onSeek={ws.seek} />
      <BottomControls onSeek={ws.seek} />
    </div>
  );
}
