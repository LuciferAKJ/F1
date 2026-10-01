/**
 * Shared test fixtures for the F1 Race Replay frontend test suite.
 *
 * These provide realistic but minimal data shapes matching the actual
 * backend response format, for use across unit and component tests.
 */

import type { RawReplayFrame, RawDriverFrame } from "@/lib/replayAdapter";
import type { DriverMeta, CircuitData } from "@/types/replay";
import type { ReplayMetadataDTO, DriverMetaDTO, CircuitDataDTO } from "@/types/api";

// ---------------------------------------------------------------------------
// Driver metadata
// ---------------------------------------------------------------------------

export const DRIVER_VER: DriverMeta = {
  abbreviation: "VER",
  teamName: "Red Bull Racing",
  teamColor: "#3671C6",
  driverNumber: "1",
};

export const DRIVER_HAM: DriverMeta = {
  abbreviation: "HAM",
  teamName: "Ferrari",
  teamColor: "#E80020",
  driverNumber: "44",
};

export const DRIVER_NOR: DriverMeta = {
  abbreviation: "NOR",
  teamName: "McLaren",
  teamColor: "#FF8000",
  driverNumber: "4",
};

export const SAMPLE_DRIVERS: DriverMeta[] = [DRIVER_VER, DRIVER_HAM, DRIVER_NOR];

// ---------------------------------------------------------------------------
// Circuit data
// ---------------------------------------------------------------------------

export const SAMPLE_CIRCUIT: CircuitData = {
  x: [0, 100, 200, 300, 200, 100, 0],
  y: [0, 50, 100, 50, 0, -50, 0],
  minX: 0,
  maxX: 300,
  minY: -50,
  maxY: 100,
};

// ---------------------------------------------------------------------------
// Raw replay frames (backend JSON shape)
// ---------------------------------------------------------------------------

function makeRawDriver(
  driverId: string,
  overrides: Partial<RawDriverFrame> = {}
): RawDriverFrame {
  return {
    driverId,
    x: 100,
    y: 200,
    speed: 300,
    gear: 7,
    throttle: 100,
    brake: false,
    rpm: 11000,
    drs: 0,
    tyre: "MEDIUM",
    lap: 1,
    sector: 1,
    position: 1,
    ...overrides,
  };
}

export function makeRawFrame(
  timestamp: number,
  lap: number,
  drivers: RawDriverFrame[]
): RawReplayFrame {
  return { timestamp, lap, drivers };
}

/**
 * A small but realistic sequence of frames with a position swap on frame 5
 * and a swap back on frame 7 — useful for testing overtake detection.
 */
export const SAMPLE_FRAMES: RawReplayFrame[] = [
  makeRawFrame(0.0, 1, [
    makeRawDriver("VER", { x: 100, y: 200, position: 1 }),
    makeRawDriver("HAM", { x: 90, y: 190, speed: 295, position: 2 }),
    makeRawDriver("NOR", { x: 80, y: 180, speed: 290, position: 3 }),
  ]),
  makeRawFrame(0.5, 1, [
    makeRawDriver("VER", { x: 110, y: 210, position: 1 }),
    makeRawDriver("HAM", { x: 100, y: 200, speed: 295, position: 2 }),
    makeRawDriver("NOR", { x: 90, y: 190, speed: 290, position: 3 }),
  ]),
  makeRawFrame(1.0, 1, [
    makeRawDriver("VER", { x: 120, y: 220, position: 1 }),
    makeRawDriver("HAM", { x: 110, y: 210, speed: 295, position: 2 }),
    makeRawDriver("NOR", { x: 100, y: 200, speed: 290, position: 3 }),
  ]),
  makeRawFrame(1.5, 2, [
    makeRawDriver("VER", { x: 130, y: 230, lap: 2, position: 1 }),
    makeRawDriver("HAM", { x: 120, y: 220, lap: 2, speed: 295, position: 2 }),
    makeRawDriver("NOR", { x: 110, y: 210, lap: 2, speed: 290, position: 3 }),
  ]),
  // Position swap: HAM overtakes VER
  makeRawFrame(2.0, 2, [
    makeRawDriver("VER", { x: 140, y: 240, lap: 2, position: 2 }),
    makeRawDriver("HAM", { x: 145, y: 245, lap: 2, speed: 310, position: 1 }),
    makeRawDriver("NOR", { x: 120, y: 220, lap: 2, speed: 290, position: 3 }),
  ]),
  makeRawFrame(2.5, 2, [
    makeRawDriver("VER", { x: 150, y: 250, lap: 2, position: 2 }),
    makeRawDriver("HAM", { x: 155, y: 255, lap: 2, speed: 308, position: 1 }),
    makeRawDriver("NOR", { x: 130, y: 230, lap: 2, speed: 290, position: 3 }),
  ]),
  // Swap back: VER retakes P1
  makeRawFrame(3.0, 3, [
    makeRawDriver("VER", { x: 165, y: 265, lap: 3, position: 1 }),
    makeRawDriver("HAM", { x: 160, y: 260, lap: 3, speed: 298, position: 2 }),
    makeRawDriver("NOR", { x: 140, y: 240, lap: 3, speed: 290, position: 3 }),
  ]),
];

// ---------------------------------------------------------------------------
// API DTO fixtures
// ---------------------------------------------------------------------------

export const SAMPLE_CIRCUIT_DTO: CircuitDataDTO = {
  x: SAMPLE_CIRCUIT.x,
  y: SAMPLE_CIRCUIT.y,
  minX: SAMPLE_CIRCUIT.minX,
  maxX: SAMPLE_CIRCUIT.maxX,
  minY: SAMPLE_CIRCUIT.minY,
  maxY: SAMPLE_CIRCUIT.maxY,
};

export const SAMPLE_DRIVER_DTOS: DriverMetaDTO[] = SAMPLE_DRIVERS.map((d) => ({
  abbreviation: d.abbreviation,
  teamName: d.teamName,
  teamColor: d.teamColor,
  driverNumber: d.driverNumber,
}));

export const SAMPLE_METADATA: ReplayMetadataDTO = {
  info: {
    year: 2024,
    event: "Monaco",
    sessionType: "R",
    sessionName: "Race",
    totalLaps: 78,
  },
  drivers: SAMPLE_DRIVER_DTOS,
  circuit: SAMPLE_CIRCUIT_DTO,
  totalLaps: 78,
  duration: 3.0,
  frameInterval: 0.5,
  frameCount: 7,
};
