"use client";

import { memo, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Activity,
  Timer,
  Radio,
  Layers,
  Sparkles,
} from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import type { RaceIntelligence } from "@/lib/raceIntelligence";
import { TelemetryTracesView } from "./TelemetryTracesView";
import { LapComparisonView } from "./LapComparisonView";
import { RaceControlView } from "./RaceControlView";
import { StrategyView } from "./StrategyView";
import { cn } from "@/lib/utils";

export type WorkbenchTab = "telemetry" | "laps" | "race-control" | "strategy";

interface AnalyticsDashboardProps {
  race: SelectedRace | null;
  onSeek: (t: number) => void;
  intelligence?: RaceIntelligence | null;
  isLoadingIntelligence?: boolean;
}

function formatRaceTime(seconds: number): string {
  const safe = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export const AnalyticsDashboard = memo(function AnalyticsDashboard({
  race,
  onSeek,
  intelligence = null,
  isLoadingIntelligence = false,
}: AnalyticsDashboardProps) {
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);
  const metadata = useReplayStore((s) => s.metadata);
  const playing = useReplayStore((s) => s.playing);

  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("telemetry");

  const driverData = useMemo(() => {
    if (!selectedDriver || !metadata?.drivers) return null;
    return metadata.drivers.find((d) => d.abbreviation === selectedDriver) ?? null;
  }, [selectedDriver, metadata]);

  const tabs: { id: WorkbenchTab; label: string; icon: React.ElementType }[] = [
    { id: "telemetry", label: "TELEMETRY", icon: Activity },
    { id: "laps", label: "LAP COMPARISON", icon: Timer },
    { id: "race-control", label: "RACE CONTROL", icon: Radio },
    { id: "strategy", label: "STRATEGY", icon: Layers },
  ];

  return (
    <div className="flex flex-col rounded-sm border border-pitwall-hairline bg-pitwall-dock select-none">
      {/* Workbench Header & Navigation Deck */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-pitwall-hairline/80 bg-pitwall-dock">
        {/* Left: Workbench Identifier & Driver Spotlight */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 font-display text-[11px] font-black uppercase tracking-wider text-pitwall-text hover:text-pitwall-telemetry transition-colors"
            aria-expanded={expanded}
            aria-label="Toggle analytics workbench"
            title={expanded ? "Collapse workbench" : "Expand workbench"}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-pitwall-telemetry" />
            ) : (
              <ChevronUp className="h-4 w-4 text-pitwall-text-muted" />
            )}
            <span>ANALYTICS WORKBENCH</span>
          </button>

          {/* Active Driver Pill */}
          {driverData ? (
            <div className="flex items-center gap-1 rounded bg-pitwall-surface px-2 py-0.5 border border-pitwall-hairline">
              <span
                className="h-2 w-1 rounded-xs"
                style={{ backgroundColor: driverData.teamColor }}
              />
              <span className="font-display text-[10px] font-bold text-pitwall-text">
                {driverData.abbreviation}
              </span>
              <span className="font-telemetry text-[9px] text-pitwall-text-muted">
                #{driverData.driverNumber}
              </span>
            </div>
          ) : (
            <span className="font-display text-[10px] text-pitwall-text-muted uppercase">
              No Driver Selected
            </span>
          )}

          {/* Replay Time Sync Indicator */}
          <div className="hidden sm:flex items-center gap-1 font-telemetry text-[9px] text-pitwall-text-muted bg-pitwall-surface/60 px-1.5 py-0.5 rounded border border-pitwall-hairline/50">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                playing ? "bg-pitwall-drs animate-pulse" : "bg-pitwall-telemetry"
              )}
            />
            <span>SYNCED: {formatRaceTime(currentTimestamp)}</span>
          </div>
        </div>

        {/* Center: Four Tab Navigation Switches */}
        <div className="flex items-center gap-0.5 rounded bg-pitwall-surface p-0.5 border border-pitwall-hairline">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id);
                  if (!expanded) setExpanded(true);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded font-display text-[10px] font-bold tracking-wider uppercase transition-all",
                  isActive
                    ? "bg-pitwall-elevated text-pitwall-telemetry border border-pitwall-telemetry/40 shadow-xs"
                    : "text-pitwall-text-muted hover:text-pitwall-text hover:bg-pitwall-dock/60"
                )}
                aria-selected={isActive}
                role="tab"
              >
                <Icon
                  className={cn(
                    "h-3 w-3",
                    isActive ? "text-pitwall-telemetry" : "text-pitwall-text-muted"
                  )}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Quick Context / Status */}
        <div className="flex items-center gap-2">
          {race?.event && (
            <span className="hidden md:inline font-display text-[10px] text-pitwall-text-muted uppercase tracking-wider">
              {race.event} {race.year > 0 ? race.year : "DEMO"}
            </span>
          )}
        </div>
      </div>

      {/* Workbench Content Area */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="analytics-workbench-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-2.5 bg-pitwall-dock/95">
              {activeTab === "telemetry" && (
                <TelemetryTracesView race={race} onSeek={onSeek} />
              )}
              {activeTab === "laps" && (
                <LapComparisonView race={race} onSeek={onSeek} />
              )}
              {activeTab === "race-control" && (
                <RaceControlView
                  race={race}
                  intelligence={intelligence}
                  isLoading={isLoadingIntelligence}
                  onSeek={onSeek}
                />
              )}
              {activeTab === "strategy" && (
                <StrategyView race={race} onSeek={onSeek} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
