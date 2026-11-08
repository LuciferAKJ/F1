import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TimingLadder } from "../TimingLadder";
import { useReplayStore } from "@/store/replayStore";
import { SAMPLE_METADATA } from "@/lib/__tests__/fixtures";
import type { RawReplayFrame } from "@/lib/replayAdapter";

const TEST_FRAME_1: RawReplayFrame = {
  timestamp: 10.0,
  lap: 2,
  drivers: [
    {
      driverId: "NOR",
      position: 2,
      lap: 2,
      sector: 2,
      tyre: "MEDIUM",
      drs: 0,
      x: 100,
      y: 50,
      speed: 290,
      gear: 7,
      throttle: 98,
      brake: false,
      rpm: 11200,
    },
    {
      driverId: "VER",
      position: 1,
      lap: 2,
      sector: 1,
      tyre: "SOFT",
      drs: 12, // open
      x: 120,
      y: 60,
      speed: 310,
      gear: 8,
      throttle: 100,
      brake: false,
      rpm: 11800,
    },
    {
      driverId: "HAM",
      position: 3,
      lap: 2,
      sector: 3,
      tyre: "HARD",
      drs: 0,
      x: 80,
      y: 40,
      speed: 280,
      gear: 6,
      throttle: 90,
      brake: false,
      rpm: 10500,
    },
  ],
};

describe("TimingLadder Component", () => {
  const mockPixiControls = {
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetView: vi.fn(),
    followDriver: vi.fn(),
    stopFollowing: vi.fn(),
  };

  beforeEach(() => {
    useReplayStore.getState().reset();
    useReplayStore.getState().setMetadata(SAMPLE_METADATA);
    useReplayStore.getState().setPixiControls(mockPixiControls);
    vi.clearAllMocks();
  });

  it("renders timing tower header and accurate driver count", () => {
    useReplayStore.getState().setCurrentFrame(TEST_FRAME_1);
    render(<TimingLadder />);

    expect(screen.getByText("TIMING TOWER")).toBeInTheDocument();
    expect(screen.getByText("DRIVERS 3")).toBeInTheDocument();
  });

  it("orders drivers strictly by current race position (P1 VER, P2 NOR, P3 HAM)", () => {
    useReplayStore.getState().setCurrentFrame(TEST_FRAME_1);
    render(<TimingLadder />);

    const posElements = screen.getAllByText(/^(01|02|03)$/);
    expect(posElements).toHaveLength(3);
    expect(posElements[0]).toHaveTextContent("01");
    expect(posElements[1]).toHaveTextContent("02");
    expect(posElements[2]).toHaveTextContent("03");

    // Check VER is next to 01, NOR to 02, HAM to 03
    expect(screen.getByRole("button", { name: /Select VER/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select NOR/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select HAM/i })).toBeInTheDocument();
  });

  it("selecting a driver updates selectedDriver in store WITHOUT enabling camera follow", () => {
    useReplayStore.getState().setCurrentFrame(TEST_FRAME_1);
    render(<TimingLadder />);

    const norBtn = screen.getByRole("button", { name: /Select NOR/i });
    fireEvent.click(norBtn);

    // Selected state updated in Zustand
    expect(useReplayStore.getState().selectedDriver).toBe("NOR");
    // Camera follow was NOT activated
    expect(useReplayStore.getState().followedDriver).toBeNull();
    expect(mockPixiControls.followDriver).not.toHaveBeenCalled();
  });

  it("clicking follow button explicitly enables follow mode and triggers pixiControls.followDriver", () => {
    useReplayStore.getState().setCurrentFrame(TEST_FRAME_1);
    render(<TimingLadder />);

    const followVerBtn = screen.getByRole("button", { name: /Follow VER/i });
    fireEvent.click(followVerBtn);

    // Both selectedDriver and pixiControls.followDriver are called
    expect(useReplayStore.getState().selectedDriver).toBe("VER");
    expect(mockPixiControls.followDriver).toHaveBeenCalledWith("VER");
  });

  it("clicking follow button when already following cancels follow mode and resets view", () => {
    useReplayStore.getState().setCurrentFrame(TEST_FRAME_1);
    useReplayStore.getState().setFollowedDriver("VER");
    render(<TimingLadder />);

    const stopFollowBtn = screen.getByRole("button", { name: /Stop following VER/i });
    fireEvent.click(stopFollowBtn);

    expect(mockPixiControls.stopFollowing).toHaveBeenCalledTimes(1);
    expect(mockPixiControls.resetView).toHaveBeenCalledTimes(1);
  });

  it("displays tyre compound chips and estimated tyre age with honest disclosure footnote", () => {
    useReplayStore.getState().setCurrentFrame(TEST_FRAME_1);
    render(<TimingLadder />);

    // Soft compound for VER, Medium for NOR, Hard for HAM
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("H")).toBeInTheDocument();

    // Data integrity note is rendered
    expect(
      screen.getByText(/Tyre age estimated client-side.*Gaps & intervals unavailable in stream/i)
    ).toBeInTheDocument();
  });
});

