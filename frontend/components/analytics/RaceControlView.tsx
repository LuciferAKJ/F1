"use client";

import { memo, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Sparkles,
  Download,
  Filter,
  Lock,
  Radio,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import type { RaceIntelligence } from "@/lib/raceIntelligence";
import { Button } from "@/components/ui/button";
import { exportJSON } from "@/lib/exportUtils";
import { toast } from "@/store/toastStore";
import { cn } from "@/lib/utils";

interface RaceControlViewProps {
  race: SelectedRace | null;
  intelligence: RaceIntelligence | null;
  isLoading?: boolean;
  onSeek: (t: number) => void;
}

interface EventItem {
  id: string;
  timestamp: number;
  lap: number;
  kind: "overtake" | "fastest-lap";
  title: string;
  detail: string;
  driver: string;
  secondaryDriver?: string;
}

function formatRaceTime(seconds: number): string {
  const safe = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

const UNAVAILABLE_INCIDENTS = [
  "Safety Car (SC)",
  "Virtual Safety Car (VSC)",
  "Red Flags",
  "Track Limits & Penalties",
  "Pit Lane Speed Status",
  "Steward Inquiries",
];

export const RaceControlView = memo(function RaceControlView({
  race,
  intelligence,
  isLoading,
  onSeek,
}: RaceControlViewProps) {
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);
  const seek = useReplayStore((s) => s.seek);

  const [filterType, setFilterType] = useState<"all" | "overtakes" | "fastest-laps" | "driver">("all");

  const events = useMemo<EventItem[]>(() => {
    if (!intelligence) return [];

    const list: EventItem[] = [];

    // Map overtakes
    for (const ot of intelligence.overtakes) {
      list.push({
        id: ot.id,
        timestamp: ot.timestamp,
        lap: ot.lap,
        kind: "overtake",
        title: `P${ot.resultingPosition} OVERTAKE`,
        detail: `${ot.gainedBy} passed ${ot.lostBy} for position P${ot.resultingPosition}`,
        driver: ot.gainedBy,
        secondaryDriver: ot.lostBy,
      });
    }

    // Map fastest laps
    for (const fl of intelligence.fastestLaps) {
      const m = Math.floor(fl.lapTime / 60);
      const s = (fl.lapTime % 60).toFixed(3).padStart(6, "0");
      list.push({
        id: fl.id,
        timestamp: fl.timestamp,
        lap: fl.lap,
        kind: "fastest-lap",
        title: `NEW FASTEST LAP`,
        detail: `${fl.driver} clocked ${m}:${s} (est. Lap ${fl.lap})`,
        driver: fl.driver,
      });
    }

    return list.sort((a, b) => a.timestamp - b.timestamp);
  }, [intelligence]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    if (filterType === "overtakes") return events.filter((e) => e.kind === "overtake");
    if (filterType === "fastest-laps") return events.filter((e) => e.kind === "fastest-lap");
    if (filterType === "driver" && selectedDriver) {
      return events.filter(
        (e) => e.driver === selectedDriver || e.secondaryDriver === selectedDriver
      );
    }
    return events;
  }, [events, filterType, selectedDriver]);

  const handleSeekEvent = (event: EventItem) => {
    seek(event.timestamp);
    onSeek(event.timestamp);
    setSelectedDriver(event.driver);
  };

  const handleExportJSON = () => {
    if (!intelligence) return;
    exportJSON(
      {
        race: race?.event ?? "race",
        overtakes: intelligence.overtakes,
        fastestLaps: intelligence.fastestLaps,
      },
      `${race?.event ?? "race"}-control-events.json`
    );
    toast.success("Exported race control events as JSON");
  };

  const overtakeCount = intelligence?.overtakes.length ?? 0;
  const fastestLapCount = intelligence?.fastestLaps.length ?? 0;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Top Controls & Filter Deck */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-pitwall-surface px-2.5 py-1.5 border border-pitwall-hairline">
        {/* Filter Pills */}
        <div className="flex items-center gap-1">
          <span className="flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-wider text-pitwall-text-muted mr-1">
            <Filter className="h-3 w-3 text-pitwall-telemetry" />
            Filter:
          </span>

          <button
            onClick={() => setFilterType("all")}
            className={cn(
              "px-2 py-0.5 rounded font-display text-[9px] font-bold tracking-wider transition-colors border",
              filterType === "all"
                ? "bg-pitwall-elevated border-pitwall-telemetry/40 text-pitwall-text"
                : "bg-pitwall-dock/60 border-pitwall-hairline/50 text-pitwall-text-muted/60 hover:text-pitwall-text-muted"
            )}
          >
            ALL ({events.length})
          </button>

          <button
            onClick={() => setFilterType("overtakes")}
            className={cn(
              "px-2 py-0.5 rounded font-display text-[9px] font-bold tracking-wider transition-colors border",
              filterType === "overtakes"
                ? "bg-pitwall-elevated border-pitwall-telemetry/40 text-pitwall-telemetry"
                : "bg-pitwall-dock/60 border-pitwall-hairline/50 text-pitwall-text-muted/60 hover:text-pitwall-text-muted"
            )}
          >
            OVERTAKES ({overtakeCount})
          </button>

          <button
            onClick={() => setFilterType("fastest-laps")}
            className={cn(
              "px-2 py-0.5 rounded font-display text-[9px] font-bold tracking-wider transition-colors border",
              filterType === "fastest-laps"
                ? "bg-pitwall-elevated border-pitwall-sector/40 text-pitwall-sector"
                : "bg-pitwall-dock/60 border-pitwall-hairline/50 text-pitwall-text-muted/60 hover:text-pitwall-text-muted"
            )}
          >
            FASTEST LAPS ({fastestLapCount})
          </button>

          {selectedDriver && (
            <button
              onClick={() => setFilterType("driver")}
              className={cn(
                "px-2 py-0.5 rounded font-display text-[9px] font-bold tracking-wider transition-colors border",
                filterType === "driver"
                  ? "bg-pitwall-elevated border-pitwall-telemetry/40 text-pitwall-text"
                  : "bg-pitwall-dock/60 border-pitwall-hairline/50 text-pitwall-text-muted/60 hover:text-pitwall-text-muted"
              )}
            >
              {selectedDriver} ONLY
            </button>
          )}
        </div>

        {/* Export JSON Button */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportJSON}
            disabled={events.length === 0}
            className="h-6 px-2 text-[10px] font-display font-bold uppercase tracking-wider border-pitwall-hairline bg-pitwall-dock text-pitwall-text-muted hover:text-white"
          >
            <Download className="h-3 w-3 mr-1" />
            Export JSON
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex h-36 items-center justify-center font-display text-xs text-pitwall-text-muted">
          Scanning race event intelligence stream…
        </div>
      )}

      {/* Chronological Event Feed */}
      {!isLoading && filteredEvents.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded border border-pitwall-hairline bg-pitwall-surface/50 p-4 text-xs text-pitwall-text-muted">
          No race events recorded matching the current filter.
        </div>
      )}

      {!isLoading && filteredEvents.length > 0 && (
        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
          {filteredEvents.map((item) => {
            const isPassed = item.timestamp <= currentTimestamp;
            const isOvertake = item.kind === "overtake";

            return (
              <div
                key={item.id}
                onClick={() => handleSeekEvent(item)}
                className={cn(
                  "flex items-center justify-between p-2 rounded border transition-all cursor-pointer select-none",
                  isPassed
                    ? "bg-pitwall-surface border-pitwall-hairline/80 hover:bg-pitwall-elevated hover:border-pitwall-telemetry/50"
                    : "bg-pitwall-dock/40 border-pitwall-hairline/40 opacity-70 hover:opacity-100"
                )}
                title="Click to seek replay to this event"
              >
                {/* Left: Timestamp & Event Badge */}
                <div className="flex items-center gap-2">
                  <span className="font-telemetry text-[11px] font-bold text-pitwall-text-muted w-20 shrink-0 font-tabular">
                    {formatRaceTime(item.timestamp)}
                  </span>

                  <span className="rounded bg-pitwall-dock px-1.5 py-0.5 font-display text-[9px] font-bold text-pitwall-text-muted border border-pitwall-hairline">
                    LAP {item.lap}
                  </span>

                  {isOvertake ? (
                    <span className="flex items-center gap-1 rounded bg-pitwall-telemetry/15 px-2 py-0.5 font-display text-[9px] font-bold text-pitwall-telemetry border border-pitwall-telemetry/30 uppercase tracking-wider">
                      <ArrowRightLeft className="h-2.5 w-2.5" />
                      {item.title}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded bg-pitwall-sector/15 px-2 py-0.5 font-display text-[9px] font-bold text-pitwall-sector border border-pitwall-sector/30 uppercase tracking-wider">
                      <Sparkles className="h-2.5 w-2.5" />
                      {item.title}
                    </span>
                  )}

                  <span className="font-body text-xs text-pitwall-text font-medium ml-1">
                    {item.detail}
                  </span>
                </div>

                {/* Right: Driver Focus & Playback Status */}
                <div className="flex items-center gap-2">
                  <span className="rounded bg-pitwall-dock px-1.5 py-0.5 font-display text-[9px] font-bold text-pitwall-text border border-pitwall-hairline">
                    {item.driver}
                  </span>

                  {isPassed ? (
                    <span className="flex items-center gap-1 font-telemetry text-[9px] font-bold text-emerald-400">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      PASSED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-telemetry text-[9px] font-bold text-pitwall-text-muted/60">
                      <Clock className="h-2.5 w-2.5" />
                      UPCOMING
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unavailable Race Control Feeds Disclosure */}
      <div className="flex flex-col gap-1 border-t border-pitwall-hairline pt-2">
        <div className="flex items-center gap-1 text-[10px] font-bold font-display uppercase tracking-wider text-pitwall-text-muted">
          <Lock className="h-2.5 w-2.5 text-amber-500/80" />
          Unavailable Incident Categories (Omitted from stream)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {UNAVAILABLE_INCIDENTS.map((item) => (
            <span
              key={item}
              className="rounded bg-pitwall-dock/50 px-1.5 py-0.5 font-display text-[9px] font-bold text-pitwall-text-muted/60 border border-pitwall-hairline/40"
            >
              {item}: N/A
            </span>
          ))}
        </div>
        <p className="font-body text-[9px] text-pitwall-text-muted/60 leading-tight mt-0.5">
          Race control intelligence is derived solely from verified on-track overtakes and fastest
          laps. Safety Cars, VSC, Red Flags, and Steward Inquiries are omitted until official FIA
          event data is available in the pipeline.
        </p>
      </div>
    </div>
  );
});

