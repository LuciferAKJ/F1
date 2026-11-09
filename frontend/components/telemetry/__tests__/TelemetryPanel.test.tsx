import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TelemetryPanel } from "../TelemetryPanel";
import { useReplayStore } from "@/store/replayStore";
import { SAMPLE_METADATA } from "@/lib/__tests__/fixtures";
import type { RawReplayFrame } from "@/lib/replayAdapter";

const TEST_FRAME: RawReplayFrame = {
  timestamp: 10.0,
  lap: 4,
  drivers: [
    {
      driverId: "VER",
      position: 1,
      lap: 4,
      sector: 2,
      tyre: "SOFT",
      drs: 12, // open
      x: 150,
      y: 80,
      speed: 318,
      gear: 7,
      throttle: 100,
      brake: false,
      rpm: 11600,
    },
    {
      driverId: "NOR",
      position: 2,
      lap: 4,
      sector: 1,
      tyre: "MEDIUM",
      drs: 0, // closed
      x: 140,
      y: 75,
      speed: 285,
      gear: 6,
      throttle: 0,
      brake: true,
      rpm: 9800,
    },
  ],
};

describe("TelemetryPanel", () => {
  beforeEach(() => {
    useReplayStore.getState().reset();
  });

  it("renders empty state when no driver is selected", () => {
    useReplayStore.setState({
      selectedDriver: null,
      currentFrame: null,
      metadata: SAMPLE_METADATA,
    });

    render(<TelemetryPanel />);

    expect(screen.getByText("TELEMETRY DECK")).toBeInTheDocument();
    expect(screen.getByText("NO DRIVER SELECTED")).toBeInTheDocument();
    expect(screen.getByText(/Click any driver on the timing ladder/i)).toBeInTheDocument();
  });

  it("renders driver identity, team, position, and lap", () => {
    useReplayStore.setState({
      selectedDriver: "VER",
      currentFrame: TEST_FRAME,
      frames: [TEST_FRAME],
      metadata: SAMPLE_METADATA,
    });

    render(<TelemetryPanel />);

    expect(screen.getByText("VER")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("Red Bull Racing")).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("L4")).toBeInTheDocument();
  });

  it("renders core instruments: gear, DRS, and speed units", () => {
    useReplayStore.setState({
      selectedDriver: "VER",
      currentFrame: TEST_FRAME,
      frames: [TEST_FRAME],
      metadata: SAMPLE_METADATA,
    });

    render(<TelemetryPanel />);

    expect(screen.getByText("GEAR")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("DRS OPEN")).toBeInTheDocument();
    expect(screen.getAllByText("KM/H").length).toBeGreaterThan(0);
    expect(screen.getByText("PEAK:")).toBeInTheDocument();
  });

  it("displays binary brake OFF state when driver is not braking", () => {
    useReplayStore.setState({
      selectedDriver: "VER",
      currentFrame: TEST_FRAME,
      frames: [TEST_FRAME],
      metadata: SAMPLE_METADATA,
    });

    render(<TelemetryPanel />);
    expect(screen.getAllByText("BRAKE OFF").length).toBeGreaterThan(0);
  });

  it("displays binary brake ON state when driver is braking", () => {
    useReplayStore.setState({
      selectedDriver: "NOR",
      currentFrame: TEST_FRAME,
      frames: [TEST_FRAME],
      metadata: SAMPLE_METADATA,
    });

    render(<TelemetryPanel />);
    expect(screen.getAllByText("BRAKE ON").length).toBeGreaterThan(0);
    expect(screen.getByText("DRS CLSD")).toBeInTheDocument();
  });

  it("displays tyre compound and estimated tyre age with explicit 'est.' qualifier", () => {
    useReplayStore.setState({
      selectedDriver: "VER",
      currentFrame: TEST_FRAME,
      frames: [TEST_FRAME],
      metadata: SAMPLE_METADATA,
    });

    render(<TelemetryPanel />);

    expect(screen.getByText("SOFT")).toBeInTheDocument();
    expect(screen.getByText(/\dL est\./)).toBeInTheDocument();
  });

  it("displays unsupported telemetry channels as N/A without fabrication", () => {
    useReplayStore.setState({
      selectedDriver: "VER",
      currentFrame: TEST_FRAME,
      frames: [TEST_FRAME],
      metadata: SAMPLE_METADATA,
    });

    render(<TelemetryPanel />);

    expect(screen.getByText("UNSUPPORTED CHANNELS")).toBeInTheDocument();
    expect(screen.getByText("ERS")).toBeInTheDocument();
    expect(screen.getByText("PIT LIMITER")).toBeInTheDocument();
    expect(screen.getByText("TYRE WEAR")).toBeInTheDocument();
    expect(screen.getByText("G-FORCE")).toBeInTheDocument();
    expect(screen.getByText(/DATA HONESTY:/)).toBeInTheDocument();
  });

  it("triggers camera follow and stop-following controls correctly", () => {
    const followDriver = vi.fn();
    const stopFollowing = vi.fn();
    const resetView = vi.fn();

    useReplayStore.setState({
      selectedDriver: "VER",
      followedDriver: null,
      currentFrame: TEST_FRAME,
      frames: [TEST_FRAME],
      metadata: SAMPLE_METADATA,
      pixiControls: {
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetView,
        followDriver,
        stopFollowing,
      },
    });

    const { rerender } = render(<TelemetryPanel />);

    const followBtn = screen.getByRole("button", { name: /Follow VER/i });
    expect(followBtn).toHaveTextContent("FOLLOW");

    fireEvent.click(followBtn);
    expect(followDriver).toHaveBeenCalledWith("VER");

    // When already followed
    useReplayStore.setState({ followedDriver: "VER" });
    rerender(<TelemetryPanel />);

    const followingBtn = screen.getByRole("button", { name: /Stop following VER/i });
    expect(followingBtn).toHaveTextContent("FOLLOWING");

    fireEvent.click(followingBtn);
    expect(stopFollowing).toHaveBeenCalledTimes(1);
    expect(resetView).toHaveBeenCalledTimes(1);
  });
});
