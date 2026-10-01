import { describe, it, expect, beforeEach } from "vitest";
import { useReplayStore } from "../replayStore";
import { SAMPLE_FRAMES, SAMPLE_METADATA } from "@/lib/__tests__/fixtures";

describe("replayStore", () => {
  beforeEach(() => {
    useReplayStore.getState().reset();
  });

  it("initializes with default state", () => {
    const state = useReplayStore.getState();
    expect(state.selectedRace).toBeNull();
    expect(state.metadata).toBeNull();
    expect(state.frames).toEqual([]);
    expect(state.playing).toBe(false);
    expect(state.playbackSpeed).toBe(1);
  });

  it("sets selected race and metadata", () => {
    const store = useReplayStore.getState();
    store.setSelectedRace({ year: 2024, event: "Monaco", sessionType: "R" });
    store.setMetadata(SAMPLE_METADATA);

    const updated = useReplayStore.getState();
    expect(updated.selectedRace).toEqual({ year: 2024, event: "Monaco", sessionType: "R" });
    expect(updated.metadata).toEqual(SAMPLE_METADATA);
  });

  it("toggles play state and changes speed", () => {
    const store = useReplayStore.getState();
    store.play();
    expect(useReplayStore.getState().playing).toBe(true);

    store.pause();
    expect(useReplayStore.getState().playing).toBe(false);

    store.togglePlay();
    expect(useReplayStore.getState().playing).toBe(true);

    store.setSpeed(2);
    expect(useReplayStore.getState().playbackSpeed).toBe(2);
  });

  it("pushes frames and sets current frame", () => {
    const store = useReplayStore.getState();
    store.pushFrame(SAMPLE_FRAMES[0]);

    const updated = useReplayStore.getState();
    expect(updated.frames).toHaveLength(1);
    expect(updated.currentFrame).toEqual(SAMPLE_FRAMES[0]);
    expect(updated.currentTimestamp).toBe(0.0);
    expect(updated.currentLap).toBe(1);
  });

  it("resets state to initial", () => {
    const store = useReplayStore.getState();
    store.setSpeed(4);
    store.play();
    store.reset();

    const resetState = useReplayStore.getState();
    expect(resetState.playing).toBe(false);
    expect(resetState.playbackSpeed).toBe(1);
  });
});
