"use client";

import { memo, useMemo, useRef } from "react";
import { ArrowUp, ArrowDown, Minus, Crosshair } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import { cn } from "@/lib/utils";
import type { RawReplayFrame } from "@/lib/replayAdapter";
import type { DriverMetaDTO } from "@/types/api";

/**
 * Formula 1 Pit-Wall Timing Ladder (Stitch Workstation Redesign Phase 3)
 *
 * Data Integrity & Honesty:
 * - REAL: Position, lap number, live sector (1/2/3), DRS state (FastF1 codes 10/12/14),
 *   tyre compound, and constructor metadata are streamed directly from the replay pipeline.
 * - ESTIMATED (labeled "est."): Tyre age and lap times are derived client-side from observed
 *   compound changes and frame timestamps quantized to the ~0.5s replay frame interval.
 * - UNAVAILABLE (never fabricated): Gap-to-leader, interval deltas, and pit stops are omitted
 *   because they are not present in the replay stream.
 */

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#E8002D",
  MEDIUM: "#FFF200",
  HARD: "#CACACA",
  INTERMEDIATE: "#39B54A",
  WET: "#0067FF",
  UNKNOWN: "#888888",
};

function isDrsOpen(drs: number | null | undefined): boolean {
  return drs === 10 || drs === 12 || drs === 14;
}

interface DerivedDriverStats {
  tyreAge: number | null;
  lastLapTime: number | null;
  bestLapTime: number | null;
}

interface DriverHistory extends DerivedDriverStats {
  compound: string;
  tyreStartLap: number;
  lastLap: number;
  lapStartTimestamp: number;
}

/**
 * Rolling per-driver history used to compute estimated tyre age and lap times.
 * Strictly ref-backed and memoized to avoid GC allocations during high-frequency replay updates.
 */
function useDerivedDriverStats(currentFrame: RawReplayFrame | null) {
  const historyRef = useRef<Map<string, DriverHistory>>(new Map());
  const lastFrameRef = useRef<RawReplayFrame | null>(null);
  const cachedResultRef = useRef<{ stats: Map<string, DerivedDriverStats>; sessionBestAbbr: string | null }>({
    stats: new Map(),
    sessionBestAbbr: null,
  });

  return useMemo(() => {
    if (!currentFrame) {
      historyRef.current.clear();
      cachedResultRef.current = { stats: new Map(), sessionBestAbbr: null };
      lastFrameRef.current = null;
      return cachedResultRef.current;
    }

    if (lastFrameRef.current === currentFrame) {
      return cachedResultRef.current;
    }

    // Reset history if timeline was scrubbed backward
    if (lastFrameRef.current && currentFrame.timestamp < lastFrameRef.current.timestamp) {
      historyRef.current.clear();
    }

    const history = historyRef.current;
    const nextStats = new Map<string, DerivedDriverStats>();
    let bestOverall = { abbr: null as string | null, time: Infinity };

    for (const d of currentFrame.drivers) {
      let h = history.get(d.driverId);
      if (!h) {
        h = {
          compound: d.tyre,
          tyreStartLap: d.lap,
          lastLap: d.lap,
          lapStartTimestamp: currentFrame.timestamp,
          tyreAge: 1,
          lastLapTime: null,
          bestLapTime: null,
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

    lastFrameRef.current = currentFrame;
    cachedResultRef.current = { stats: nextStats, sessionBestAbbr: bestOverall.abbr };
    return cachedResultRef.current;
  }, [currentFrame]);
}

interface TimingLadderRowProps {
  driverId: string;
  position: number | null;
  positionDelta: number;
  teamColor: string;
  teamName: string;
  driverNumber?: string;
  lap: number | null;
  sector: number | null;
  tyre: string | null;
  tyreAge: number | null;
  drs: number | null;
  isFastestLap: boolean;
  isSelected: boolean;
  isFollowed: boolean;
  onSelect: (abbr: string) => void;
  onToggleFollow: (e: React.MouseEvent, abbr: string) => void;
}

function areRowPropsEqual(prev: TimingLadderRowProps, next: TimingLadderRowProps): boolean {
  return (
    prev.driverId === next.driverId &&
    prev.position === next.position &&
    prev.positionDelta === next.positionDelta &&
    prev.teamColor === next.teamColor &&
    prev.teamName === next.teamName &&
    prev.driverNumber === next.driverNumber &&
    prev.lap === next.lap &&
    prev.sector === next.sector &&
    prev.tyre === next.tyre &&
    prev.tyreAge === next.tyreAge &&
    prev.drs === next.drs &&
    prev.isFastestLap === next.isFastestLap &&
    prev.isSelected === next.isSelected &&
    prev.isFollowed === next.isFollowed
  );
}

const TimingLadderRow = memo(function TimingLadderRow({
  driverId,
  position,
  positionDelta,
  teamColor,
  teamName,
  driverNumber,
  lap,
  sector,
  tyre,
  tyreAge,
  drs,
  isSelected,
  isFollowed,
  onSelect,
  onToggleFollow,
}: TimingLadderRowProps) {
  const drsActive = isDrsOpen(drs);
  const formattedPos = position !== null ? String(position).padStart(2, "0") : "—";
  const compoundBg = COMPOUND_COLORS[tyre?.toUpperCase() ?? "UNKNOWN"] ?? "#888888";
  const compoundTextDark = tyre?.toUpperCase() === "MEDIUM" || tyre?.toUpperCase() === "HARD";

  return (
    <div
      className={cn(
        "group flex h-7 items-center justify-between border-b border-pitwall-divider px-2 transition-colors",
        isSelected
          ? "bg-pitwall-elevated ring-1 ring-pitwall-telemetry/60"
          : "hover:bg-pitwall-elevated/50 bg-pitwall-dock/40"
      )}
    >
      {/* Left: Position, Delta, Team Ribbon, and Driver Selector */}
      <div className="flex flex-1 min-w-0 items-center gap-1.5 overflow-hidden">
        {/* Race Position */}
        <span
          className={cn(
            "w-5 shrink-0 text-center font-telemetry font-bold text-xs font-tabular",
            position === 1 ? "text-pitwall-drs" : "text-pitwall-text"
          )}
        >
          {formattedPos}
        </span>

        {/* Position Delta vs Previous Frame */}
        <span className="flex w-2.5 shrink-0 justify-center" title="Position delta vs previous frame">
          {positionDelta > 0 && <ArrowUp className="h-3 w-3 text-pitwall-drs" />}
          {positionDelta < 0 && <ArrowDown className="h-3 w-3 text-pitwall-signal" />}
          {positionDelta === 0 && <Minus className="h-2 w-2 text-pitwall-text-muted/30" />}
        </span>

        {/* Official Constructor Ribbon */}
        <span
          className="h-3.5 w-[3px] shrink-0 rounded-full"
          style={{ backgroundColor: teamColor }}
          aria-hidden="true"
        />

        {/* Driver Selection Button */}
        <button
          type="button"
          onClick={() => onSelect(driverId)}
          aria-pressed={isSelected}
          aria-label={`Select ${driverId}, ${teamName}`}
          className="flex flex-1 min-w-0 items-center gap-1 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pitwall-telemetry"
        >
          <span
            className={cn(
              "font-display font-black text-xs tracking-wider",
              isSelected ? "text-pitwall-telemetry-light" : "text-pitwall-text group-hover:text-white"
            )}
          >
            {driverId}
          </span>
          {driverNumber && (
            <span className="hidden sm:inline font-telemetry text-[9px] text-pitwall-text-muted/60 font-tabular">
              #{driverNumber}
            </span>
          )}
        </button>
      </div>

      {/* Right: Sector, Lap, Tyre Badge + Age, DRS Indicator, and Explicit Follow Button */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Live Sector Split (1, 2, 3) */}
        {sector !== null && (
          <span className="hidden md:flex items-center gap-0.5" title={`Currently in Sector ${sector}`}>
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 w-1.5 rounded-xs",
                  s === sector ? "bg-amber-400" : "bg-pitwall-hairline"
                )}
              />
            ))}
          </span>
        )}

        {/* Current Lap */}
        <span
          className="w-7 text-right font-telemetry text-[10px] text-pitwall-text-muted font-tabular"
          title={lap !== null ? `Lap ${lap}` : "Lap unknown"}
        >
          {lap !== null ? `L${lap}` : "—"}
        </span>

        {/* Tyre Compound Badge and Estimated Stint Age */}
        <div
          className="flex items-center gap-1"
          title={
            tyreAge !== null
              ? `${tyre ?? "Tyre"} · ${tyreAge} lap${tyreAge === 1 ? "" : "s"} (est.)`
              : tyre ?? "Tyre unavailable"
          }
        >
          <span
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-xs font-telemetry text-[9px] font-black border border-black/40"
            style={{
              backgroundColor: compoundBg,
              color: compoundTextDark ? "#000000" : "#FFFFFF",
            }}
          >
            {tyre ? tyre.charAt(0) : "—"}
          </span>
          <span className="w-5 text-right font-telemetry text-[10px] text-pitwall-text-muted font-tabular">
            {tyreAge !== null ? `${tyreAge}L` : "—"}
          </span>
        </div>

        {/* DRS Active Indicator */}
        <span
          className={cn(
            "rounded px-1 py-0.2 font-telemetry text-[9px] font-bold border leading-none",
            drsActive
              ? "bg-pitwall-drs/20 border-pitwall-drs/50 text-pitwall-drs"
              : "bg-pitwall-dock border-pitwall-hairline text-pitwall-text-muted/40"
          )}
          title={drsActive ? "DRS Active (Flap Open)" : "DRS Closed"}
        >
          DRS
        </span>

        {/* Follow Driver Camera Toggle */}
        <button
          type="button"
          onClick={(e) => onToggleFollow(e, driverId)}
          className={cn(
            "rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pitwall-telemetry",
            isFollowed
              ? "text-pitwall-signal bg-pitwall-signal/20 ring-1 ring-pitwall-signal/40"
              : isSelected
              ? "text-pitwall-text-muted hover:text-white hover:bg-pitwall-elevated"
              : "opacity-40 group-hover:opacity-100 text-pitwall-text-muted hover:text-white hover:bg-pitwall-elevated"
          )}
          title={
            isFollowed
              ? `Following ${driverId} — click to return to overview`
              : `Follow ${driverId}`
          }
          aria-label={isFollowed ? `Stop following ${driverId}` : `Follow ${driverId}`}
        >
          <Crosshair className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}, areRowPropsEqual);

export function TimingLadder() {
  const currentFrame = useReplayStore((s) => s.currentFrame);
  const metadata = useReplayStore((s) => s.metadata);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const followedDriver = useReplayStore((s) => s.followedDriver);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);
  const pixiControls = useReplayStore((s) => s.pixiControls);

  const prevPositionsRef = useRef<Map<string, number>>(new Map());
  const lastDeltaFrameRef = useRef<RawReplayFrame | null>(null);
  const cachedDeltasRef = useRef<Map<string, number>>(new Map());

  const { stats: derivedStats, sessionBestAbbr } = useDerivedDriverStats(currentFrame);

  const driverMetaById = useMemo(() => {
    const map = new Map<string, DriverMetaDTO>();
    metadata?.drivers?.forEach((d) => map.set(d.abbreviation, d));
    return map;
  }, [metadata]);

  // Derive ▲/▼ position movement relative to the previous frame
  const positionDeltas = useMemo(() => {
    if (!currentFrame) {
      prevPositionsRef.current.clear();
      cachedDeltasRef.current = new Map();
      lastDeltaFrameRef.current = null;
      return cachedDeltasRef.current;
    }

    if (lastDeltaFrameRef.current === currentFrame) {
      return cachedDeltasRef.current;
    }

    if (lastDeltaFrameRef.current && currentFrame.timestamp < lastDeltaFrameRef.current.timestamp) {
      prevPositionsRef.current.clear();
    }

    const nextDeltas = new Map<string, number>();
    for (const d of currentFrame.drivers) {
      const prev = prevPositionsRef.current.get(d.driverId);
      nextDeltas.set(d.driverId, prev !== undefined ? prev - d.position : 0);
    }

    const nextPrev = new Map<string, number>();
    currentFrame.drivers.forEach((d) => nextPrev.set(d.driverId, d.position));
    prevPositionsRef.current = nextPrev;
    lastDeltaFrameRef.current = currentFrame;
    cachedDeltasRef.current = nextDeltas;

    return nextDeltas;
  }, [currentFrame]);

  // Driver rows ordered strictly by live position (or metadata order if awaiting initial frame)
  const rows = useMemo(() => {
    if (currentFrame && currentFrame.drivers.length > 0) {
      const sorted = [...currentFrame.drivers].sort((a, b) => a.position - b.position);
      return sorted.map((frame) => {
        const meta = driverMetaById.get(frame.driverId);
        const derived = derivedStats.get(frame.driverId) ?? { tyreAge: null, lastLapTime: null, bestLapTime: null };
        const positionDelta = positionDeltas.get(frame.driverId) ?? 0;
        const isFastestLap = sessionBestAbbr === frame.driverId;
        return {
          driverId: frame.driverId,
          position: frame.position,
          positionDelta,
          teamColor: meta?.teamColor ?? "#888888",
          teamName: meta?.teamName ?? "Constructor",
          driverNumber: meta?.driverNumber,
          lap: frame.lap,
          sector: frame.sector,
          tyre: frame.tyre,
          tyreAge: derived.tyreAge,
          drs: frame.drs,
          isFastestLap,
        };
      });
    }

    if (metadata?.drivers && metadata.drivers.length > 0) {
      return metadata.drivers.map((d, index) => ({
        driverId: d.abbreviation,
        position: index + 1,
        positionDelta: 0,
        teamColor: d.teamColor ?? "#888888",
        teamName: d.teamName ?? "Constructor",
        driverNumber: d.driverNumber,
        lap: null,
        sector: null,
        tyre: null,
        tyreAge: null,
        drs: null,
        isFastestLap: false,
      }));
    }

    return [];
  }, [currentFrame, metadata, driverMetaById, derivedStats, positionDeltas, sessionBestAbbr]);

  const handleSelect = (abbr: string) => {
    setSelectedDriver(abbr);
    // If camera follow is ALREADY active, smoothly update target to new selection
    if (followedDriver) {
      pixiControls?.followDriver(abbr);
    }
  };

  const handleToggleFollow = (e: React.MouseEvent, abbr: string) => {
    e.stopPropagation();
    if (followedDriver === abbr) {
      pixiControls?.stopFollowing();
      pixiControls?.resetView();
    } else {
      setSelectedDriver(abbr);
      pixiControls?.followDriver(abbr);
    }
  };

  const driverCount = rows.length;

  return (
    <div className="flex flex-col h-full rounded-sm border border-pitwall-hairline bg-pitwall-dock overflow-hidden select-none">
      {/* Header Deck */}
      <div className="flex items-center justify-between border-b border-pitwall-hairline bg-pitwall-surface px-2.5 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-pitwall-drs animate-pulse" />
          <h2 className="font-display font-bold text-xs uppercase tracking-wider text-pitwall-text">
            TIMING TOWER
          </h2>
        </div>
        <span className="rounded bg-pitwall-elevated px-1.5 py-0.5 font-telemetry text-[10px] font-bold text-pitwall-telemetry border border-pitwall-hairline">
          DRIVERS {driverCount}
        </span>
      </div>

      {/* Column Micro-Headers */}
      <div className="flex items-center justify-between border-b border-pitwall-divider bg-pitwall-dock/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-pitwall-text-muted font-display shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-5 text-center">POS</span>
          <span>DRIVER</span>
        </div>
        <div className="flex items-center gap-2 pr-1">
          <span className="hidden md:inline">SECT</span>
          <span className="w-7 text-right">LAP</span>
          <span className="w-10 text-right">TYRE</span>
          <span className="w-6 text-center">DRS</span>
          <span className="w-3" />
        </div>
      </div>

      {/* 20-Car Dense Scrollable Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-pitwall-divider/40">
        {driverCount === 0 && (
          <div className="p-3 text-center font-display text-xs text-pitwall-text-muted">
            Waiting for driver telemetry…
          </div>
        )}
        {rows.map((row) => (
          <TimingLadderRow
            key={row.driverId}
            driverId={row.driverId}
            position={row.position}
            positionDelta={row.positionDelta}
            teamColor={row.teamColor}
            teamName={row.teamName}
            driverNumber={row.driverNumber}
            lap={row.lap}
            sector={row.sector}
            tyre={row.tyre}
            tyreAge={row.tyreAge}
            drs={row.drs}
            isFastestLap={row.isFastestLap}
            isSelected={selectedDriver === row.driverId}
            isFollowed={followedDriver === row.driverId}
            onSelect={handleSelect}
            onToggleFollow={handleToggleFollow}
          />
        ))}
      </div>

      {/* Technical Footnote (Data Honesty) */}
      <div className="border-t border-pitwall-divider bg-pitwall-surface/60 px-2 py-1 text-[9px] font-display text-pitwall-text-muted leading-tight shrink-0">
        Tyre age estimated client-side (~0.5s). Gaps &amp; intervals unavailable in stream.
      </div>
    </div>
  );
}

