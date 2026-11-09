"use client";

import { memo, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Lock, Timer, Info } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import { useDriverSeries, type TelemetryPoint } from "@/hooks/useDriverSeries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LapComparisonViewProps {
  race: SelectedRace | null;
  onSeek: (t: number) => void;
}

interface LapData {
  lapNumber: number;
  startTime: number;
  endTime: number;
  duration: number; // seconds
  peakSpeed: number;
  avgThrottle: number;
  points: TelemetryPoint[];
}

function formatLapTime(seconds: number): string {
  const safe = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const m = Math.floor(safe / 60);
  const s = (safe % 60).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

export const LapComparisonView = memo(function LapComparisonView({
  race,
  onSeek,
}: LapComparisonViewProps) {
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const metadata = useReplayStore((s) => s.metadata);
  const seek = useReplayStore((s) => s.seek);

  const { series, isLoading } = useDriverSeries(race, selectedDriver);

  // Group driver telemetry points into distinct laps
  const laps = useMemo<LapData[]>(() => {
    if (!series || series.length === 0) return [];

    const map = new Map<number, TelemetryPoint[]>();
    for (const pt of series) {
      const lapNum = pt.lap ?? 1;
      const existing = map.get(lapNum) ?? [];
      existing.push(pt);
      map.set(lapNum, existing);
    }

    const result: LapData[] = [];
    for (const [lapNumber, points] of map.entries()) {
      if (points.length < 2) continue;
      const startTime = points[0].t;
      const endTime = points[points.length - 1].t;
      const duration = Math.max(0, endTime - startTime);

      let maxSpeed = 0;
      let throttleSum = 0;
      for (const p of points) {
        if (p.speed > maxSpeed) maxSpeed = p.speed;
        throttleSum += p.throttle;
      }
      const avgThrottle = points.length > 0 ? throttleSum / points.length : 0;

      result.push({
        lapNumber,
        startTime,
        endTime,
        duration,
        peakSpeed: maxSpeed,
        avgThrottle,
        points,
      });
    }

    return result.sort((a, b) => a.lapNumber - b.lapNumber);
  }, [series]);

  const [refLapNum, setRefLapNum] = useState<number>(1);
  const [compLapNum, setCompLapNum] = useState<number>(2);

  const refLap = useMemo(
    () => laps.find((l) => l.lapNumber === refLapNum) ?? laps[0] ?? null,
    [laps, refLapNum]
  );
  const compLap = useMemo(
    () => laps.find((l) => l.lapNumber === compLapNum) ?? laps[1] ?? null,
    [laps, compLapNum]
  );

  // Synchronize speed traces along normalized elapsed lap seconds
  const comparisonTraceData = useMemo(() => {
    if (!refLap || !compLap) return [];

    const maxDuration = Math.max(refLap.duration, compLap.duration, 1);
    const step = 0.5; // frame interval
    const totalSteps = Math.ceil(maxDuration / step);

    const rows: { elapsed: number; refSpeed?: number; compSpeed?: number }[] = [];

    for (let i = 0; i <= totalSteps; i++) {
      const sec = Number((i * step).toFixed(1));
      const refPt = refLap.points.find((p) => Math.abs(p.t - refLap.startTime - sec) < 0.3);
      const compPt = compLap.points.find((p) => Math.abs(p.t - compLap.startTime - sec) < 0.3);

      rows.push({
        elapsed: sec,
        refSpeed: refPt ? refPt.speed : undefined,
        compSpeed: compPt ? compPt.speed : undefined,
      });
    }

    return rows;
  }, [refLap, compLap]);

  if (!selectedDriver) {
    return (
      <div className="flex h-36 items-center justify-center rounded border border-pitwall-hairline bg-pitwall-surface/50 p-4 text-xs text-pitwall-text-muted">
        Select a driver on the timing ladder to compare completed laps.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-36 items-center justify-center font-display text-xs text-pitwall-text-muted">
        Analyzing lap records…
      </div>
    );
  }

  const hasMultipleLaps = laps.length >= 2;
  const timeDelta = refLap && compLap ? compLap.duration - refLap.duration : 0;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Top Lap Selection Deck */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-pitwall-surface px-2.5 py-1.5 border border-pitwall-hairline">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-wider text-pitwall-text-muted">
            <Timer className="h-3 w-3 text-pitwall-telemetry" />
            Driver:
          </span>
          <span className="rounded bg-pitwall-elevated px-2 py-0.5 font-display text-xs font-bold text-pitwall-text border border-pitwall-hairline">
            {selectedDriver}
          </span>
          <span className="font-telemetry text-[10px] text-pitwall-text-muted">
            {laps.length} {laps.length === 1 ? "lap" : "laps"} recorded
          </span>
        </div>

        {hasMultipleLaps && (
          <div className="flex items-center gap-3">
            {/* Reference Lap */}
            <div className="flex items-center gap-1">
              <span className="font-display text-[10px] uppercase font-bold text-pitwall-telemetry">
                Ref Lap:
              </span>
              <Select
                value={String(refLap?.lapNumber ?? 1)}
                onValueChange={(v) => setRefLapNum(Number(v))}
              >
                <SelectTrigger className="h-6 w-20 text-[10px] font-telemetry bg-pitwall-dock border-pitwall-hairline">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-pitwall-dock border-pitwall-hairline text-pitwall-text text-xs">
                  {laps.map((l) => (
                    <SelectItem key={l.lapNumber} value={String(l.lapNumber)}>
                      Lap {l.lapNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Comparison Lap */}
            <div className="flex items-center gap-1">
              <span className="font-display text-[10px] uppercase font-bold text-pitwall-signal">
                Comp Lap:
              </span>
              <Select
                value={String(compLap?.lapNumber ?? 2)}
                onValueChange={(v) => setCompLapNum(Number(v))}
              >
                <SelectTrigger className="h-6 w-20 text-[10px] font-telemetry bg-pitwall-dock border-pitwall-hairline">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-pitwall-dock border-pitwall-hairline text-pitwall-text text-xs">
                  {laps.map((l) => (
                    <SelectItem key={l.lapNumber} value={String(l.lapNumber)}>
                      Lap {l.lapNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Multi-Lap Comparison Metrics & Speed Delta Chart */}
      {hasMultipleLaps && refLap && compLap && (
        <div className="flex flex-col gap-2">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex flex-col gap-0.5 rounded border border-pitwall-telemetry/40 bg-pitwall-surface p-2">
              <span className="font-display text-[10px] font-bold uppercase text-pitwall-telemetry">
                Reference: Lap {refLap.lapNumber}
              </span>
              <span className="font-telemetry text-base font-bold font-tabular text-pitwall-text">
                {formatLapTime(refLap.duration)}
                <span className="text-[9px] font-normal text-pitwall-text-muted ml-1">est.</span>
              </span>
              <span className="font-telemetry text-[9px] text-pitwall-text-muted">
                Peak: {refLap.peakSpeed} km/h · Avg Thr: {refLap.avgThrottle.toFixed(0)}%
              </span>
            </div>

            <div className="flex flex-col gap-0.5 rounded border border-pitwall-signal/40 bg-pitwall-surface p-2">
              <span className="font-display text-[10px] font-bold uppercase text-pitwall-signal">
                Comparison: Lap {compLap.lapNumber}
              </span>
              <span className="font-telemetry text-base font-bold font-tabular text-pitwall-text">
                {formatLapTime(compLap.duration)}
                <span className="text-[9px] font-normal text-pitwall-text-muted ml-1">est.</span>
              </span>
              <span className="font-telemetry text-[9px] text-pitwall-text-muted">
                Peak: {compLap.peakSpeed} km/h · Avg Thr: {compLap.avgThrottle.toFixed(0)}%
              </span>
            </div>

            <div className="flex flex-col gap-0.5 rounded border border-pitwall-hairline bg-pitwall-surface p-2">
              <span className="font-display text-[10px] font-bold uppercase text-pitwall-text-muted">
                Lap Time Delta (Δt)
              </span>
              <span
                className={`font-telemetry text-base font-bold font-tabular ${
                  timeDelta > 0
                    ? "text-red-400"
                    : timeDelta < 0
                    ? "text-emerald-400"
                    : "text-pitwall-text"
                }`}
              >
                {timeDelta > 0 ? `+${timeDelta.toFixed(3)}s` : `${timeDelta.toFixed(3)}s`}
                <span className="text-[9px] font-normal text-pitwall-text-muted ml-1">
                  {timeDelta > 0 ? "(SLOWER)" : timeDelta < 0 ? "(FASTER)" : "(EVEN)"}
                </span>
              </span>
              <span className="font-telemetry text-[9px] text-pitwall-text-muted">
                Speed Diff: {(compLap.peakSpeed - refLap.peakSpeed).toFixed(0)} km/h top end
              </span>
            </div>
          </div>

          {/* Speed Overlay Comparison Chart */}
          <div className="rounded border border-pitwall-hairline bg-pitwall-surface p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-pitwall-text-muted">
              <span className="font-display font-bold uppercase tracking-wider text-pitwall-text">
                SPEED TRACE OVERLAY: LAP {refLap.lapNumber} VS LAP {compLap.lapNumber}
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-telemetry">
                  <span className="h-1.5 w-1.5 rounded-full bg-pitwall-telemetry" />
                  Lap {refLap.lapNumber} (Ref)
                </span>
                <span className="flex items-center gap-1 font-telemetry">
                  <span className="h-1.5 w-1.5 rounded-full bg-pitwall-signal" />
                  Lap {compLap.lapNumber} (Comp)
                </span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart
                data={comparisonTraceData}
                margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid stroke="#283541" strokeDasharray="3 3" />
                <XAxis
                  dataKey="elapsed"
                  type="number"
                  domain={[0, "dataMax"]}
                  tickFormatter={(v) => `${v}s`}
                  stroke="#95A3AF"
                  fontSize={10}
                />
                <YAxis domain={[0, 360]} stroke="#95A3AF" fontSize={10} width={34} />
                <Tooltip
                  contentStyle={{
                    background: "#111820",
                    border: "1px solid #283541",
                    fontSize: 11,
                    color: "#EAF0F5",
                  }}
                  labelFormatter={(v) => `Elapsed: ${v}s`}
                />
                <Line
                  type="monotone"
                  dataKey="refSpeed"
                  stroke="#00C8E8"
                  dot={false}
                  strokeWidth={1.75}
                  isAnimationActive={false}
                  name={`Lap ${refLap.lapNumber}`}
                />
                <Line
                  type="monotone"
                  dataKey="compSpeed"
                  stroke="#E10600"
                  dot={false}
                  strokeWidth={1.75}
                  strokeDasharray="4 2"
                  isAnimationActive={false}
                  name={`Lap ${compLap.lapNumber}`}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Honest Empty State when only 1 Lap exists in session */}
      {!hasMultipleLaps && (
        <div className="flex flex-col gap-2 rounded border border-pitwall-hairline bg-pitwall-surface/70 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold font-display uppercase tracking-wider text-pitwall-text">
            <Info className="h-3.5 w-3.5 text-pitwall-telemetry" />
            Single Lap Recorded in Current Replay Window
          </div>

          {refLap && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1">
              <div className="flex flex-col rounded bg-pitwall-dock p-2 border border-pitwall-hairline">
                <span className="font-display text-[10px] text-pitwall-text-muted uppercase">
                  Observed Lap
                </span>
                <span className="font-telemetry text-sm font-bold text-pitwall-text">
                  Lap {refLap.lapNumber}
                </span>
              </div>
              <div className="flex flex-col rounded bg-pitwall-dock p-2 border border-pitwall-hairline">
                <span className="font-display text-[10px] text-pitwall-text-muted uppercase">
                  Derived Duration
                </span>
                <span className="font-telemetry text-sm font-bold text-pitwall-text font-tabular">
                  {formatLapTime(refLap.duration)}
                  <span className="text-[9px] font-normal text-pitwall-text-muted ml-1">est.</span>
                </span>
              </div>
              <div className="flex flex-col rounded bg-pitwall-dock p-2 border border-pitwall-hairline">
                <span className="font-display text-[10px] text-pitwall-text-muted uppercase">
                  Peak Velocity
                </span>
                <span className="font-telemetry text-sm font-bold text-pitwall-telemetry font-tabular">
                  {refLap.peakSpeed} km/h
                </span>
              </div>
            </div>
          )}

          <div className="rounded border border-pitwall-hairline/80 bg-pitwall-dock/50 p-2 flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 text-amber-500/80 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-[10px] font-bold uppercase text-pitwall-text">
                Multi-Lap Delta & Sector Splits Unavailable
              </span>
              <p className="font-body text-[10px] leading-tight text-pitwall-text-muted">
                Only Lap 1 is available in this replay segment. Additional completed laps are
                required for multi-lap delta analysis. Official timing transponder sector split times
                (S1/S2/S3) are not streamed by the telemetry pipeline.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Notes */}
      <div className="flex items-center justify-between text-[9px] text-pitwall-text-muted/60 font-body px-1 border-t border-pitwall-hairline pt-1.5">
        <span>
          Lap durations and deltas are derived from frame boundary timestamps (~0.5s resolution).
        </span>
        <span>Official FIA transponder timing is unavailable in this telemetry stream.</span>
      </div>
    </div>
  );
});

