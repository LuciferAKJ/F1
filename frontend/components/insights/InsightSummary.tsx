"use client";

import { Trophy, TrendingUp, Gauge, ArrowRightLeft, Users, Clock, Flag } from "lucide-react";
import type { SessionSummary } from "@/lib/raceInsights";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

interface StatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function Stat({ icon: Icon, label, value }: StatProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-black/20 px-2.5 py-2">
      <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-white">{value}</p>
        <p className="text-[10px] text-muted">{label}</p>
      </div>
    </div>
  );
}

interface InsightSummaryProps {
  summary: SessionSummary | null;
}

export function InsightSummary({ summary }: InsightSummaryProps) {
  if (!summary) return <p className="text-xs text-muted">Analyzing race data…</p>;

  // Only render stats whose underlying value was actually derivable — unavailable values are omitted, not guessed.
  const stats: StatProps[] = [];
  if (summary.winner) stats.push({ icon: Trophy, label: "Winner (so far)", value: summary.winner });
  if (summary.biggestGain) stats.push({ icon: TrendingUp, label: "Biggest gain", value: `${summary.biggestGain.driver} +${summary.biggestGain.places}` });
  if (summary.fastestLap) stats.push({ icon: Gauge, label: `Fastest lap (Lap ${summary.fastestLap.lap})`, value: `${summary.fastestLap.driver} ${formatLapTime(summary.fastestLap.lapTime)}` });
  stats.push({ icon: ArrowRightLeft, label: "Overtakes detected", value: String(summary.totalOvertakes) });
  stats.push({ icon: Users, label: "Drivers compared", value: String(summary.driversCompared) });
  if (summary.raceDurationLaps !== null) stats.push({ icon: Flag, label: "Race duration", value: `${summary.raceDurationLaps} laps` });
  stats.push({ icon: Clock, label: "Replay duration", value: formatTime(summary.replayDuration) });
  if (summary.averageSpeedKmh !== null) stats.push({ icon: Gauge, label: "Average speed", value: `${summary.averageSpeedKmh.toFixed(0)} km/h` });

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {stats.map((s) => (
        <Stat key={s.label} {...s} />
      ))}
    </div>
  );
}
