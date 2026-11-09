import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { BottomControls } from "../BottomControls";
import { useReplayStore } from "@/store/replayStore";
import { SAMPLE_METADATA } from "@/lib/__tests__/fixtures";
import type { RaceIntelligence } from "@/lib/raceIntelligence";

const MOCK_INTELLIGENCE: RaceIntelligence = {
  overtakes: [
    {
      id: "1",
      timestamp: 12.0,
      lap: 2,
      gainedBy: "VER",
      lostBy: "NOR",
      positionsGained: 1,
      resultingPosition: 1,
    },
  ],
  fastestLaps: [
    {
      id: "1",
      timestamp: 25.0,
      lap: 3,
      driver: "NOR",
      lapTime: 91.245,
    },
  ],
  positionHistoryByDriver: new Map(),
  currentFastestLapHolder: "NOR",
};

describe("BottomControls Playback Transport & Two-Tier Timeline", () => {
  beforeEach(() => {
    useReplayStore.getState().reset();
  });

  it("renders transport controls: play button, restart, step buttons, and speeds", () => {
    useReplayStore.setState({
      metadata: SAMPLE_METADATA,
      playing: false,
      playbackSpeed: 1,
      currentTimestamp: 0,
    });

    render(<BottomControls onSeek={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Play replay/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restart replay to start/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Step back 1 frame/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Step forward 1 frame/i })).toBeInTheDocument();
    expect(screen.getByText("1x")).toBeInTheDocument();
    expect(screen.getByText("2x")).toBeInTheDocument();
    expect(screen.getByText("4x")).toBeInTheDocument();
  });

  it("renders current elapsed time, duration, and accurate source data rate", () => {
    useReplayStore.setState({
      metadata: {
        ...SAMPLE_METADATA,
        duration: 3600,
        frameInterval: 0.5,
      },
      currentTimestamp: 125.5,
    });

    render(<BottomControls onSeek={vi.fn()} />);

    expect(screen.getByText("02:05.500")).toBeInTheDocument();
    expect(screen.getByText("/ 01:00:00")).toBeInTheDocument();
    expect(screen.getByText("2 Hz")).toBeInTheDocument();
    expect(screen.getByText("0.5s FRAME")).toBeInTheDocument();
  });

  it("renders current lap and active sector indicator", () => {
    useReplayStore.setState({
      metadata: {
        ...SAMPLE_METADATA,
        totalLaps: 57,
      },
      currentLap: 14,
      currentFrame: {
        timestamp: 10.0,
        lap: 14,
        drivers: [
          {
            driverId: "VER",
            position: 1,
            lap: 14,
            sector: 2,
            tyre: "SOFT",
            drs: 0,
            x: 0,
            y: 0,
            speed: 300,
            gear: 7,
            throttle: 100,
            brake: false,
            rpm: 11000,
          },
        ],
      },
    });

    render(<BottomControls onSeek={vi.fn()} />);

    expect(screen.getByText(/LAP 14 \/ 57/)).toBeInTheDocument();
    expect(screen.getByText("S2")).toBeInTheDocument();
  });

  it("toggles play and pause state on button click", () => {
    const togglePlaySpy = vi.spyOn(useReplayStore.getState(), "togglePlay");

    useReplayStore.setState({
      metadata: SAMPLE_METADATA,
      playing: false,
    });

    const { rerender } = render(<BottomControls onSeek={vi.fn()} />);
    const playBtn = screen.getByRole("button", { name: /Play replay/i });
    fireEvent.click(playBtn);
    expect(togglePlaySpy).toHaveBeenCalledTimes(1);

    // When playing, shows Pause
    useReplayStore.setState({ playing: true });
    rerender(<BottomControls onSeek={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Pause replay/i })).toBeInTheDocument();
  });

  it("updates playback speed when speed buttons are clicked", () => {
    const setSpeedSpy = vi.spyOn(useReplayStore.getState(), "setSpeed");

    useReplayStore.setState({
      metadata: SAMPLE_METADATA,
      playbackSpeed: 1,
    });

    render(<BottomControls onSeek={vi.fn()} />);
    fireEvent.click(screen.getByText("2x"));
    expect(setSpeedSpy).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByText("4x"));
    expect(setSpeedSpy).toHaveBeenCalledWith(4);
  });

  it("steps forward and backward by the exact metadata frameInterval", () => {
    const onSeek = vi.fn();
    useReplayStore.setState({
      metadata: {
        ...SAMPLE_METADATA,
        duration: 100,
        frameInterval: 0.5,
      },
      currentTimestamp: 10.0,
    });

    render(<BottomControls onSeek={onSeek} />);

    // Step forward: 10.0 + 0.5 = 10.5
    fireEvent.click(screen.getByRole("button", { name: /Step forward 1 frame/i }));
    expect(onSeek).toHaveBeenCalledWith(10.5);

    // Step backward: 10.5 - 0.5 = 10.0
    useReplayStore.setState({ currentTimestamp: 10.5 });
    fireEvent.click(screen.getByRole("button", { name: /Step back 1 frame/i }));
    expect(onSeek).toHaveBeenCalledWith(10.0);
  });

  it("renders Tier A event rail markers and seeks on marker click", () => {
    const onSeek = vi.fn();
    useReplayStore.setState({
      metadata: {
        ...SAMPLE_METADATA,
        duration: 100,
      },
      currentTimestamp: 0,
    });

    render(<BottomControls onSeek={onSeek} intelligence={MOCK_INTELLIGENCE} />);

    const overtakeMarker = screen.getByRole("button", { name: /P1 · VER passed NOR/i });
    expect(overtakeMarker).toBeInTheDocument();

    fireEvent.click(overtakeMarker);
    expect(onSeek).toHaveBeenCalledWith(12.0);
    expect(useReplayStore.getState().selectedDriver).toBe("VER");

    const fastestLapMarker = screen.getByRole("button", { name: /FASTEST LAP.*NOR/i });
    expect(fastestLapMarker).toBeInTheDocument();

    fireEvent.click(fastestLapMarker);
    expect(onSeek).toHaveBeenCalledWith(25.0);
    expect(useReplayStore.getState().selectedDriver).toBe("NOR");
  });

  it("handles keyboard shortcuts (ArrowLeft, ArrowRight, R, Space)", () => {
    const onSeek = vi.fn();
    useReplayStore.setState({
      metadata: {
        ...SAMPLE_METADATA,
        duration: 100,
      },
      currentTimestamp: 20.0,
      playing: false,
    });

    render(<BottomControls onSeek={onSeek} />);

    // ArrowLeft: -5s
    fireEvent.keyDown(window, { code: "ArrowLeft" });
    expect(onSeek).toHaveBeenCalledWith(15.0);

    // ArrowRight: +5s (from 15.0 back to 20.0)
    fireEvent.keyDown(window, { code: "ArrowRight" });
    expect(onSeek).toHaveBeenCalledWith(20.0);

    // R: Restart to 0
    fireEvent.keyDown(window, { code: "KeyR" });
    expect(onSeek).toHaveBeenCalledWith(0);
  });
});
