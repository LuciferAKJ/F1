import { describe, it, expect } from "vitest";
import { generateInsights } from "../raceInsights";
import { analyzeRace } from "../raceIntelligence";
import { SAMPLE_FRAMES } from "./fixtures";

describe("raceInsights", () => {
  it("generates full insights and session summary from frames and intelligence", () => {
    const intelligence = analyzeRace(SAMPLE_FRAMES);
    const { insights, summary } = generateInsights(SAMPLE_FRAMES, intelligence);

    expect(Array.isArray(insights)).toBe(true);
    expect(summary.totalOvertakes).toBe(intelligence.overtakes.length);
    expect(summary.winner).toBe("VER");
    expect(summary.replayDuration).toBe(3.0);
    expect(summary.driversCompared).toBe(intelligence.positionHistoryByDriver.size);
  });

  it("handles empty frames input gracefully", () => {
    const intelligence = analyzeRace([]);
    const { insights, summary } = generateInsights([], intelligence);

    expect(insights).toEqual([]);
    expect(summary.winner).toBeNull();
    expect(summary.replayDuration).toBe(0);
  });
});
