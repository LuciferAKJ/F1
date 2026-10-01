"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, ArrowDown, Minus, Rows3, List, Sparkles } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import { cn } from "@/lib/utils";
import type { RawDriverFrame, RawReplayFrame } from "@/lib/replayAdapter";
import type { DriverMetaDTO } from "@/types/api";

/**
 * F1 TV-style live timing tower.
 *
 * Data honesty note: the replay stream (RawDriverFrame) carries position/lap/
 * tyre/DRS/sector directly from the backend — those are rendered as-is. Gap-to-
 * leader, interval, pit status, and full driver name aren't in the pipeline at
 * all and are intentionally omitted (footnote explains why) rather than faked.
 *
 * Tyre age and lap times ARE derived client-side from real observed fields
 * (compound + lap number + frame timestamps as they stream in) — genuinely
 * computed, not fabricated, but only as precise as the ~0.5s backend frame
 * interval allows. Both are labeled "est." and explained via title tooltips.
 */

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#DA291C", MEDIUM: "#FFD12E", HARD: "#F0F0F0",
  INTERMEDIATE: "#43B02A", WET: "#0067AD", UNKNOWN: "#888888",
};

// FastF1 DRS status codes: 10/12/14 = flap open. Everything else = closed/unavailable.
function isDrsOpen(drs: number): boolean {
  return drs === 10 || drs === 12 || drs === 14;
}

function formatLapTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

interface DerivedDriverStats {
  tyreAge: number | null; // laps completed on the current compound (estimate)
  lastLapTime: number | null; // seconds, estimate quantized to frame interval
  bestLapTime: number | null; // seconds, this driver's best estimated lap so far
}

interface DriverHistory extends DerivedDriverStats {
  compound: string;
  tyreStartLap: number;
  lastLap: number;
  lapStartTimestamp: number;
}

/** Rolling per-driver history used to derive tyre age + approximate lap times as frames stream in. */
function useDerivedDriverStats(currentFrame: RawReplayFrame | null) {
  const historyRef = useRef<Map<string, DriverHistory>>(new Map());
  const [stats, setStats] = useState<Map<string, DerivedDriverStats>>(new Map());
  const [sessionBestAbbr, setSessionBestAbbr] = useState<string | null>(null);

  useEffect(() => {
    if (!currentFrame) return;
    const history = historyRef.current;
    const nextStats = new Map<string, DerivedDriverStats>();
    let bestOverall = { abbr: null as string | null, time: Infinity };

    for (const d of currentFrame.drivers) {
      let h = history.get(d.driverId);
      if (!h) {
        h = {
          compound: d.tyre, tyreStartLap: d.lap, lastLap: d.lap,
          lapStartTimestamp: currentFrame.timestamp,
          tyreAge: 1, lastLapTime: null, bestLapTime: null,
        };
      } else {
        if (d.tyre !== h.compound) {
          h.compound = d.tyre;
          h.tyreStartLap = d.lap;
        }
        if (d.lap > h.lastLap) {
          const lapTime = currentFrame.timestamp - h.lapStartTimestamp;
          h.lastLapTime = lapTime;
          h.bestLapTime = h.bestLapTime === null ? lapTime : Math.min(h.bestLapTime, lapTime);
          h.lapStartTimestamp = currentFrame.timestamp;
          h.lastLap = d.lap;
        }
        h.tyreAge = d.lap - h.tyreStartLap + 1;
      }
      history.set(d.driverId, h);
      nextStats.set(d.driverId, { tyreAge: h.tyreAge, lastLapTime: h.lastLapTime, bestLapTime: h.bestLapTime });

      if (h.bestLapTime !== null && h.bestLapTime < bestOverall.time) {
        bestOverall = { abbr: d.driverId, time: h.bestLapTime };
      }
    }

    setStats(nextStats);
    setSessionBestAbbr(bestOverall.abbr);
  }, [currentFrame]);

  return { stats, sessionBestAbbr };
}

interface RowData {
  frame: RawDriverFrame;
  meta: DriverMetaDTO | undefined;
  positionDelta: number; // positive = moved up N places, negative = moved down, 0 = unchanged/unknown
  derived: DerivedDriverStats;
  isFastestLap: boolean;
}

interface RowProps {
  data: RowData;
  selected: boolean;
  compact: boolean;
  onSelect: (abbr: string) => void;
}

function rowPropsEqual(prev: RowProps, next: RowProps): boolean {
  const a = prev.data.frame;
  const b = next.data.frame;
  return (
    a.position === b.position &&
    a.lap === b.lap &&
    a.tyre === b.tyre &&
    a.drs === b.drs &&
    a.sector === b.sector &&
    prev.data.positionDelta === next.data.positionDelta &&
    prev.data.derived.tyreAge === next.data.derived.tyreAge &&
    prev.data.derived.lastLapTime === next.data.derived.lastLapTime &&
    prev.data.isFastestLap === next.data.isFastestLap &&
    prev.selected === next.selected &&
    prev.compact === next.compact
  );
}

const LeaderboardRow = memo(function LeaderboardRow({ data, selected, compact, onSelect }: RowProps) {
  const { frame, meta, positionDelta, derived, isFastestLap } = data;
  const drsOpen = isDrsOpen(frame.drs);

  return (
    <motion.button
      layout
      layoutId={`driver-row-${frame.driverId}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ layout: { type: "spring", stiffness: 500, damping: 40, mass: 0.6 }, opacity: { duration: 0.15 } }}
      onClick={() => onSelect(frame.driverId)}
      className={cn(
        "flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        frame.position === 1 ? "bg-accent/90 text-white" : "bg-black/30 text-white hover:bg-black/50",
        isFastestLap && "ring-1 ring-purple-400",
        selected && "ring-1 ring-accent"
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span className="w-5 shrink-0 text-center text-xs font-bold text-muted">{frame.position}</span>

        <span className="flex w-3 shrink-0 justify-center" title="Position change vs. previous frame">
          {positionDelta > 0 && <ArrowUp className="h-3 w-3 text-green-400" />}
          {positionDelta < 0 && <ArrowDown className="h-3 w-3 text-red-400" />}
          {positionDelta === 0 && <Minus className="h-3 w-3 text-muted/40" />}
        </span>

        <span className="h-4 w-1 shrink-0 rounded-sm" style={{ backgroundColor: meta?.teamColor ?? "#888888" }} />

        <span className="w-10 shrink-0 font-bold">{frame.driverId}</span>

        {!compact && (
          <span className="hidden flex-1 truncate text-xs text-muted md:inline">
            {meta?.teamName ?? ""}
            {meta?.driverNumber ? ` · #${meta.driverNumber}` : ""}
          </span>
        )}
        {compact && <span className="flex-1" />}

        <span className="hidden shrink-0 text-xs text-muted sm:inline">L{frame.lap}</span>

        {/* Live sector position — genuinely real-time, not derived/approximate. */}
        <span className="hidden shrink-0 gap-0.5 sm:flex" title={`Currently in sector ${frame.sector}`}>
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={cn("h-1.5 w-1.5 rounded-full", s === frame.sector ? "bg-amber-400" : "bg-white/15")}
            />
          ))}
        </span>

        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/40"
          style={{ backgroundColor: COMPOUND_COLORS[frame.tyre] ?? "#888888" }}
          title={frame.tyre}
        />

        <span
          className={cn(
            "shrink-0 rounded px-1 text-[10px] font-bold",
            drsOpen ? "bg-green-500/80 text-black" : "bg-black/40 text-muted"
          )}
        >
          DRS
        </span>
      </div>

      {!compact && (
        <div className="flex items-center gap-3 pl-10 text-[10px] text-muted">
          <span title="Estimated laps on current tyre compound (from lap count since last compound change)">
            Tyre age: {derived.tyreAge ?? "—"} lap{derived.tyreAge === 1 ? "" : "s"} est.
          </span>
          <span title="Estimated lap time, quantized to the ~0.5s replay frame interval">
            Last lap: ~{formatLapTime(derived.lastLapTime)}
          </span>
          {isFastestLap && (
            <span className="flex items-center gap-0.5 rounded bg-purple-500/80 px-1 font-bold text-white">
              <Sparkles className="h-2.5 w-2.5" /> FL
            </span>
          )}
        </div>
      )}
    </motion.button>
  );
}, rowPropsEqual);

export function LeaderboardPanel() {
  const currentFrame = useReplayStore((s) => s.currentFrame);
  const metadata = useReplayStore((s) => s.metadata);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);
  const [compact, setCompact] = useState(false);

  const prevPositions = useRef<Map<string, number>>(new Map());
  const [positionDeltas, setPositionDeltas] = useState<Map<string, number>>(new Map());
  const { stats: derivedStats, sessionBestAbbr } = useDerivedDriverStats(currentFrame);

  const driverMetaById = useMemo(() => {
    const map = new Map<string, DriverMetaDTO>();
    metadata?.drivers.forEach((d) => map.set(d.abbreviation, d));
    return map;
  }, [metadata]);

  const ordered = useMemo(
    () => (currentFrame ? [...currentFrame.drivers].sort((a, b) => a.position - b.position) : []),
    [currentFrame]
  );

  // Diff against the previous frame's positions to derive real ▲/▼ indicators.
  useEffect(() => {
    if (!currentFrame) return;
    const nextDeltas = new Map<string, number>();
    for (const d of currentFrame.drivers) {
      const prev = prevPositions.current.get(d.driverId);
      nextDeltas.set(d.driverId, prev !== undefined ? prev - d.position : 0);
    }
    setPositionDeltas(nextDeltas);

    const nextPrev = new Map<string, number>();
    currentFrame.drivers.forEach((d) => nextPrev.set(d.driverId, d.position));
    prevPositions.current = nextPrev;
  }, [currentFrame]);

  const rows: RowData[] = useMemo(
    () =>
      ordered.map((frame) => ({
        frame,
        meta: driverMetaById.get(frame.driverId),
        positionDelta: positionDeltas.get(frame.driverId) ?? 0,
        derived: derivedStats.get(frame.driverId) ?? { tyreAge: null, lastLapTime: null, bestLapTime: null },
        isFastestLap: sessionBestAbbr === frame.driverId,
      })),
    [ordered, driverMetaById, positionDeltas, derivedStats, sessionBestAbbr]
  );

  return (
    <div className="flex flex-col rounded-xl border border-border bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Leaderboard</h3>
        <button
          onClick={() => setCompact((c) => !c)}
          className="rounded p-1 text-muted hover:bg-black/40 hover:text-white"
          title={compact ? "Expand rows" : "Compact rows"}
        >
          {compact ? <Rows3 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
        {rows.length === 0 && <p className="text-xs text-muted">Waiting for data…</p>}
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <LeaderboardRow
              key={row.frame.driverId}
              data={row}
              selected={selectedDriver === row.frame.driverId}
              compact={compact}
              onSelect={setSelectedDriver}
            />
          ))}
        </AnimatePresence>
      </div>

      <p className="mt-2 text-[10px] leading-tight text-muted/70">
        Tyre age and lap times are client-side estimates from lap/compound changes (~0.5s
        precision) — labeled &quot;est.&quot;. Gap/interval, pit status, per-sector personal-best
        colors, and full driver name aren&apos;t in the replay pipeline yet, so they&apos;re
        hidden rather than faked.
      </p>
    </div>
  );
}
