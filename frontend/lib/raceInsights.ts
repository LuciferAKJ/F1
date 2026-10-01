import type { RawReplayFrame } from "@/lib/replayAdapter";
import type { RaceIntelligence } from "@/lib/raceIntelligence";

/**
 * "AI Race Insights" is a rule-based analysis engine — not an LLM call. It
 * reads only fields that already exist in the replay pipeline (position, lap,
 * sector, tyre compound, DRS status, speed, and the overtakes/fastest-laps
 * already detected by lib/raceIntelligence.ts) and turns them into engineer-
 * style natural-language observations. Nothing here estimates tyre
 * degradation, infers corner names/DRS zone locations, or invents timing
 * gaps — where real data would be needed and isn't available, that category
 * of insight is simply not generated (see the per-analyzer comments below).
 */

export type InsightCategory =
  | "overtake" | "battle" | "pace" | "tyres" | "consistency"
  | "speed" | "drs" | "position" | "strategy" | "general";

export type InsightSeverity = "low" | "medium" | "high";

export interface Insight {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  lap: number;
  drivers: string[];
  category: InsightCategory;
  severity: InsightSeverity;
}

export interface SessionSummary {
  winner: string | null;
  biggestGain: { driver: string; places: number } | null;
  fastestLap: { driver: string; lapTime: number; lap: number } | null;
  totalOvertakes: number;
  driversCompared: number;
  replayDuration: number;
  averageSpeedKmh: number | null;
  raceDurationLaps: number | null;
}

const BATTLE_MIN_FRAMES = 12; // ~6s at the backend's 0.5s frame interval
const LONG_STINT_LAPS = 15;
const NOTABLE_POSITION_CHANGE = 3;

function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

function isDrsOpen(drs: number): boolean {
  return drs === 10 || drs === 12 || drs === 14;
}

// --- Analyzers that reuse already-detected race intelligence (no re-scanning) ---

function overtakeInsights(intelligence: RaceIntelligence): Insight[] {
  return intelligence.overtakes.map((e) => ({
    id: `insight-${e.id}`,
    title: `${e.gainedBy} overtakes ${e.lostBy}`,
    description: `${e.gainedBy} passed ${e.lostBy} for P${e.resultingPosition} on Lap ${e.lap}.`,
    timestamp: e.timestamp, lap: e.lap, drivers: [e.gainedBy, e.lostBy],
    category: "overtake" as const, severity: (e.resultingPosition <= 3 ? "high" : "medium") as InsightSeverity,
  }));
}

function fastestLapInsights(intelligence: RaceIntelligence): Insight[] {
  const events = intelligence.fastestLaps;
  return events.map((e, i) => {
    const isFinal = i === events.length - 1;
    return {
      id: `insight-${e.id}`,
      title: isFinal ? `${e.driver} sets the fastest lap of the race` : `${e.driver} takes the fastest lap`,
      description: `${e.driver} set a ${formatLapTime(e.lapTime)} on Lap ${e.lap}` +
        (isFinal ? " — the fastest of the race." : ", the fastest so far."),
      timestamp: e.timestamp, lap: e.lap, drivers: [e.driver],
      category: "speed" as const, severity: (isFinal ? "high" : "low") as InsightSeverity,
    };
  });
}

/** Position-trend + pace-shape observations, derived purely from lap-by-lap position history. */
function paceAndPositionInsights(intelligence: RaceIntelligence): Insight[] {
  const insights: Insight[] = [];

  intelligence.positionHistoryByDriver.forEach((history, driver) => {
    if (history.length < 2) return;
    const start = history[0];
    const end = history[history.length - 1];
    const netChange = start.position - end.position; // positive = gained places

    if (Math.abs(netChange) >= 1) {
      insights.push({
        id: `insight-position-${driver}`,
        title: netChange > 0 ? `${driver} gained ${netChange} place${netChange === 1 ? "" : "s"}` : `${driver} lost ${Math.abs(netChange)} place${Math.abs(netChange) === 1 ? "" : "s"}`,
        description: netChange > 0
          ? `${driver} moved from P${start.position} to P${end.position} across the race.`
          : `${driver} dropped from P${start.position} to P${end.position} across the race.`,
        timestamp: end.timestamp, lap: end.lap, drivers: [driver],
        category: "position", severity: Math.abs(netChange) >= NOTABLE_POSITION_CHANGE ? "high" : "low",
      });
    } else if (netChange === 0) {
      insights.push({
        id: `insight-position-hold-${driver}`,
        title: `${driver} maintained P${end.position}`,
        description: `${driver} started and finished the race in P${end.position}.`,
        timestamp: end.timestamp, lap: end.lap, drivers: [driver],
        category: "position", severity: "low",
      });
    }

    // Recovery-drive shape: dropped notably below the start position at some point,
    // then recovered to finish better than that low point.
    let worst = start.position;
    let worstIdx = 0;
    history.forEach((p, idx) => { if (p.position > worst) { worst = p.position; worstIdx = idx; } });
    const recovered = worst - end.position;
    if (worstIdx > 0 && worstIdx < history.length - 1 && recovered >= NOTABLE_POSITION_CHANGE) {
      insights.push({
        id: `insight-recovery-${driver}`,
        title: `${driver} recovery drive`,
        description: `${driver} fell to P${worst} around Lap ${history[worstIdx].lap} before recovering ${recovered} place${recovered === 1 ? "" : "s"} to finish P${end.position}.`,
        timestamp: end.timestamp, lap: end.lap, drivers: [driver],
        category: "consistency", severity: "medium",
      });
    } else if (Math.abs(netChange) <= 1 && history.length >= 5) {
      // Genuinely flat trace = stable, low-drama race pace.
      const volatility = history.reduce((acc, p, idx) => idx === 0 ? 0 : acc + Math.abs(p.position - history[idx - 1].position), 0);
      if (volatility <= history.length) {
        insights.push({
          id: `insight-stable-${driver}`,
          title: `${driver} ran a stable race`,
          description: `${driver} held a consistent track position for most of the race, finishing P${end.position}.`,
          timestamp: end.timestamp, lap: end.lap, drivers: [driver],
          category: "consistency", severity: "low",
        });
      }
    }
  });

  return insights;
}

// --- Analyzers requiring a single pass over the full frame stream ---

interface BattleTracker {
  driverA: string;
  driverB: string;
  startTimestamp: number;
  startLap: number;
  frameCount: number;
  swaps: number;
}

interface TyreStint {
  driver: string;
  compound: string;
  startLap: number;
  endLap: number;
}

interface FrameScanResult {
  battles: Insight[];
  tyres: Insight[];
  drs: Insight[];
  averageSpeedKmh: number | null;
}

function scanFrames(frames: RawReplayFrame[]): FrameScanResult {
  const battleInsights: Insight[] = [];
  const activeBattles = new Map<string, BattleTracker>(); // key = "posA-posB" adjacent pair

  const stints = new Map<string, TyreStint>(); // driver -> current stint
  const completedStints: TyreStint[] = [];

  const drsActivations = new Map<string, number>(); // driver -> count of closed->open transitions
  const lastDrs = new Map<string, boolean>();

  let speedSum = 0;
  let speedCount = 0;

  function finalizeBattle(tracker: BattleTracker) {
    if (tracker.frameCount >= BATTLE_MIN_FRAMES) {
      battleInsights.push({
        id: `insight-battle-${tracker.driverA}-${tracker.driverB}-${tracker.startTimestamp}`,
        title: `${tracker.driverA} and ${tracker.driverB} battle`,
        description: `${tracker.driverA} and ${tracker.driverB} ran nose-to-tail from Lap ${tracker.startLap}, ` +
          `inferred from sustained adjacent track position over the replay (exact timing gaps aren't available).`,
        timestamp: tracker.startTimestamp, lap: tracker.startLap, drivers: [tracker.driverA, tracker.driverB],
        category: "battle", severity: tracker.frameCount > BATTLE_MIN_FRAMES * 3 ? "high" : "medium",
      });
    }
  }

  for (const frame of frames) {
    const byPosition = new Map<number, string>();
    for (const d of frame.drivers) byPosition.set(d.position, d.driverId);

    // --- Battles: adjacent-position pairs (P, P+1) sustained across frames ---
    const currentPairs = new Set<string>();
    byPosition.forEach((driverA, pos) => {
      const driverB = byPosition.get(pos + 1);
      if (!driverB) return;
      const key = `${pos}`;
      currentPairs.add(key);
      const pairId = [driverA, driverB].sort().join("-");
      const existing = activeBattles.get(key);
      if (existing && [existing.driverA, existing.driverB].sort().join("-") === pairId) {
        existing.frameCount += 1;
      } else {
        if (existing) finalizeBattle(existing);
        activeBattles.set(key, { driverA, driverB, startTimestamp: frame.timestamp, startLap: frame.lap, frameCount: 1, swaps: 0 });
      }
    });
    for (const [key, tracker] of activeBattles) {
      if (!currentPairs.has(key)) {
        finalizeBattle(tracker);
        activeBattles.delete(key);
      }
    }

    // --- Tyre stints ---
    for (const d of frame.drivers) {
      const stint = stints.get(d.driverId);
      if (!stint) {
        stints.set(d.driverId, { driver: d.driverId, compound: d.tyre, startLap: d.lap, endLap: d.lap });
      } else if (stint.compound !== d.tyre) {
        completedStints.push({ ...stint, endLap: Math.max(stint.endLap, d.lap - 1) });
        stints.set(d.driverId, { driver: d.driverId, compound: d.tyre, startLap: d.lap, endLap: d.lap });
      } else {
        stint.endLap = d.lap;
      }
    }

    // --- DRS activations ---
    for (const d of frame.drivers) {
      const open = isDrsOpen(d.drs);
      const prevOpen = lastDrs.get(d.driverId) ?? false;
      if (open && !prevOpen) drsActivations.set(d.driverId, (drsActivations.get(d.driverId) ?? 0) + 1);
      lastDrs.set(d.driverId, open);
      speedSum += d.speed;
      speedCount += 1;
    }
  }
  // Flush any battles still active at the end of the replay.
  activeBattles.forEach((tracker) => finalizeBattle(tracker));
  stints.forEach((stint) => completedStints.push(stint));

  const tyreInsights: Insight[] = completedStints
    .filter((s) => s.endLap > s.startLap) // skip zero/one-lap slivers, too noisy to be a useful "insight"
    .map((s) => {
      const length = s.endLap - s.startLap + 1;
      const long = length >= LONG_STINT_LAPS;
      return {
        id: `insight-tyre-${s.driver}-${s.startLap}-${s.compound}`,
        title: long ? `${s.driver} long ${s.compound.toLowerCase()} stint` : `${s.driver} ${s.compound.toLowerCase()} stint`,
        description: `${s.driver} ran ${s.compound} tyres for ${length} laps (Lap ${s.startLap}–${s.endLap}).`,
        timestamp: 0, lap: s.startLap, drivers: [s.driver],
        category: "tyres" as const, severity: (long ? "medium" : "low") as InsightSeverity,
      };
    });

  // DRS: one summary insight for whoever used it most, to avoid per-activation spam
  // and because we have no zone/location data to make individual activations meaningful.
  let topDrsDriver: string | null = null;
  let topDrsCount = 0;
  drsActivations.forEach((count, driver) => {
    if (count > topDrsCount) { topDrsCount = count; topDrsDriver = driver; }
  });
  const drsInsights: Insight[] = topDrsDriver && topDrsCount > 0
    ? [{
        id: `insight-drs-${topDrsDriver}`,
        title: `${topDrsDriver} led DRS activations`,
        description: `${topDrsDriver} activated DRS ${topDrsCount} times over the race — the most of any driver, ` +
          `suggesting significant time spent within striking distance of a rival (DRS zone locations aren't in the current data).`,
        timestamp: 0, lap: 0, drivers: [topDrsDriver],
        category: "drs" as const, severity: "low" as InsightSeverity,
      }]
    : [];

  return {
    battles: battleInsights,
    tyres: tyreInsights,
    drs: drsInsights,
    averageSpeedKmh: speedCount > 0 ? speedSum / speedCount : null,
  };
}

export function generateInsights(
  frames: RawReplayFrame[],
  intelligence: RaceIntelligence,
): { insights: Insight[]; summary: SessionSummary } {
  const scan = scanFrames(frames);
  const insights: Insight[] = [
    ...overtakeInsights(intelligence),
    ...fastestLapInsights(intelligence),
    ...paceAndPositionInsights(intelligence),
    ...scan.battles,
    ...scan.tyres,
    ...scan.drs,
  ].sort((a, b) => a.timestamp - b.timestamp);

  // --- Session summary ---
  let winner: string | null = null;
  let maxLap = -1;
  const lastFrame = frames[frames.length - 1];
  if (lastFrame) {
    const leader = lastFrame.drivers.find((d) => d.position === 1);
    winner = leader?.driverId ?? null;
  }
  frames.forEach((f) => { if (f.lap > maxLap) maxLap = f.lap; });

  interface GainRecord { driver: string; places: number }
  const gainRecords: GainRecord[] = [];
  intelligence.positionHistoryByDriver.forEach((history, driver) => {
    if (history.length < 2) return;
    gainRecords.push({ driver, places: history[0].position - history[history.length - 1].position });
  });
  const biggestGainRecord = gainRecords.length > 0
    ? gainRecords.reduce((a, b) => (b.places > a.places ? b : a))
    : null;

  const finalFastestLap = intelligence.fastestLaps[intelligence.fastestLaps.length - 1] ?? null;

  const summary: SessionSummary = {
    winner,
    biggestGain: biggestGainRecord && biggestGainRecord.places > 0 ? biggestGainRecord : null,
    fastestLap: finalFastestLap ? { driver: finalFastestLap.driver, lapTime: finalFastestLap.lapTime, lap: finalFastestLap.lap } : null,
    totalOvertakes: intelligence.overtakes.length,
    driversCompared: intelligence.positionHistoryByDriver.size,
    replayDuration: lastFrame ? lastFrame.timestamp : 0,
    averageSpeedKmh: scan.averageSpeedKmh,
    raceDurationLaps: maxLap >= 0 ? maxLap : null,
  };

  return { insights, summary };
}
