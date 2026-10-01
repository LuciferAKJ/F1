import { describe, it, expect } from "vitest";
import { toReplayFrame } from "../replayAdapter";
import { SAMPLE_FRAMES } from "./fixtures";

describe("replayAdapter", () => {
  it("converts raw backend frame to ReplayFrame shape", () => {
    const raw = SAMPLE_FRAMES[0];
    const frame = toReplayFrame(raw);

    expect(frame.raceTimeSeconds).toBe(0.0);
    expect(frame.lap).toBe(1);
    expect(Object.keys(frame.drivers)).toEqual(["VER", "HAM", "NOR"]);

    const ver = frame.drivers["VER"];
    expect(ver).toEqual({
      abbr: "VER",
      x: 100,
      y: 200,
      speed: 300,
      gear: 7,
      throttle: 100,
      brake: false,
      rpm: 11000,
      drs: 0,
      heading: 0,
      lap: 1,
      sector: 1,
      compound: "MEDIUM",
      pit: false,
    });
  });

  it("handles custom weather option", () => {
    const raw = SAMPLE_FRAMES[0];
    const customWeather = {
      airTemp: 25,
      trackTemp: 40,
      humidity: 50,
      windSpeed: 10,
      rainfall: false,
    };
    const frame = toReplayFrame(raw, customWeather);
    expect(frame.weather).toEqual(customWeather);
  });
});
