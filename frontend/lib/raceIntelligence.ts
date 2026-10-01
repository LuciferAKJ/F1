import type { RawReplayFrame } from "@/lib/replayAdapter";

/**
 * Race Intelligence analysis: derives overtakes, fastest laps, and position
 * history purely from the existing frame stream (position/lap/timestamp
 * fields already in the pipeline). Nothing here is fabricated —
 * lap times are computed from observed lap-transition timestamps (so their
 * precision is bounded by the backend's ~0.5s frame interval), and overtakes
 * are only reported for clean 1-for-1 position swaps between consecutive
 * frames (multi-car incidents, e.g. a pit-stop reshuffle touching 3+ cars at
 * once, intentionally don't generate an event rather than guessing at one).
 */

export interface OvertakeEvent {
  id: string;
  timestamp: number;
  lap: number;
  gainedBy: string;
  lostBy: string;
  positionsGained: number; // always 1 — see module note above
  resultingPosition: number; // the position gainedBy now holds
}

export interface FastestLapEvent {
  id: string;
  timestamp: number;
  lap: number;
  driver: string;
  lapTime: number; // seconds, derived from frame timestamps — ~frame-interval precision
}

export interface PositionHistoryPoint {
  lap: number;
  timestamp: number;
  position: number;
}

export interface RaceIntelligence {
  overtakes: OvertakeEvent[];
  fastestLaps: FastestLapEvent[];
  positionHistoryByDriver: Map<string, PositionHistoryPoint[]>;
  currentFastestLapHolder: string | null;
}

export function analyzeRace(frames: RawReplayFrame[]): RaceIntelligence {
  const overtakes: OvertakeEvent[] = [];
  const fastestLaps: FastestLapEvent[] = [];
  const positionHistoryByDriver = new Map<string, PositionHistoryPoint[]>();

  let lastPositions = new Map<string, number>();
  const lapStartTime = new Map<string, number>(); // driver -> timestamp when their current lap began
  const lastLapSeen = new Map<string, number>();
  let sessionBest: { driver: string; time: number } | null = null;

  for (const frame of frames) {
    const currentPositions = new Map<string, number>();
    for (const d of frame.drivers) currentPositions.set(d.driverId, d.position);

    // --- Overtakes: a driver whose position improved by exactly one place,
    // paired with whichever driver simultaneously took their old spot. ---
    if (lastPositions.size > 0) {
      for (const [driver, pos] of currentPositions) {
        const prevPos = lastPositions.get(driver);
        if (prevPos === undefined || pos !== prevPos - 1) continue;

        for (const [otherDriver, otherPos] of currentPositions) {
          if (otherDriver === driver) continue;
          if (otherPos === prevPos && lastPositions.get(otherDriver) === pos) {
            overtakes.push({
              id: `ot-${frame.timestamp}-${driver}-${otherDriver}`,
              timestamp: frame.timestamp,
              lap: frame.lap,
              gainedBy: driver,
              lostBy: otherDriver,
              positionsGained: 1,
              resultingPosition: pos,
            });
            break;
          }
        }
      }
    }
    lastPositions = currentPositions;

    // --- Fastest laps + position history ---
    for (const d of frame.drivers) {
      const seenLap = lastLapSeen.get(d.driverId);
      if (seenLap === undefined || d.lap !== seenLap) {
        const history = positionHistoryByDriver.get(d.driverId) ?? [];
        history.push({ lap: d.lap, timestamp: frame.timestamp, position: d.position });
        positionHistoryByDriver.set(d.driverId, history);

        const startTime = lapStartTime.get(d.driverId);
        if (seenLap !== undefined && startTime !== undefined) {
          const lapTime = frame.timestamp - startTime;
          if (!sessionBest || lapTime < sessionBest.time) {
            sessionBest = { driver: d.driverId, time: lapTime };
            fastestLaps.push({
              id: `fl-${frame.timestamp}-${d.driverId}`,
              timestamp: frame.timestamp,
              lap: seenLap,
              driver: d.driverId,
              lapTime,
            });
          }
        }
        lapStartTime.set(d.driverId, frame.timestamp);
        lastLapSeen.set(d.driverId, d.lap);
      }
    }
  }

  return {
    overtakes,
    fastestLaps,
    positionHistoryByDriver,
    currentFastestLapHolder: sessionBest?.driver ?? null,
  };
}
