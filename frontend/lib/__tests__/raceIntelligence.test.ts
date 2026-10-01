import { describe, it, expect } from "vitest";
import { analyzeRace } from "../raceIntelligence";
import { SAMPLE_FRAMES } from "./fixtures";

describe("raceIntelligence", () => {
  it("detects overtake events in frame sequence", () => {
    const analysis = analyzeRace(SAMPLE_FRAMES);

    expect(analysis.overtakes.length).toBeGreaterThanOrEqual(1);
    
    // In frame index 4 (timestamp 2.0), HAM overtakes VER
    const hamOvertake = analysis.overtakes.find(
      (ot) => ot.gainedBy === "HAM" && ot.lostBy === "VER"
    );
    expect(hamOvertake).toBeDefined();
    expect(hamOvertake?.resultingPosition).toBe(1);

    // In frame index 6 (timestamp 3.0), VER retakes P1 from HAM
    const verOvertake = analysis.overtakes.find(
      (ot) => ot.gainedBy === "VER" && ot.lostBy === "HAM"
    );
    expect(verOvertake).toBeDefined();
    expect(verOvertake?.resultingPosition).toBe(1);
  });

  it("builds position history per driver", () => {
    const analysis = analyzeRace(SAMPLE_FRAMES);
    const verHistory = analysis.positionHistoryByDriver.get("VER");
    expect(verHistory).toBeDefined();
    expect(verHistory?.length).toBeGreaterThan(0);
    expect(verHistory![0].position).toBe(1);
  });

  it("returns empty intelligence for empty frame array", () => {
    const analysis = analyzeRace([]);
    expect(analysis.overtakes).toEqual([]);
    expect(analysis.fastestLaps).toEqual([]);
    expect(analysis.currentFastestLapHolder).toBeNull();
  });
});
