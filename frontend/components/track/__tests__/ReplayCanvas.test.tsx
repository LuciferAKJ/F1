import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ReplayCanvas } from "../ReplayCanvas";
import { useReplayStore } from "@/store/replayStore";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/hooks/usePixiReplay", () => ({
  usePixiReplay: () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetView: vi.fn(),
    followDriver: vi.fn(),
    stopFollowing: vi.fn(),
  }),
}));

describe("ReplayCanvas loading and error states", () => {
  beforeEach(() => {
    useReplayStore.getState().reset();
    mockPush.mockClear();
  });

  it("shows loading overlay when metadata is not yet loaded", () => {
    render(<ReplayCanvas />);
    expect(screen.getByText("Loading circuit data…")).toBeInTheDocument();
  });

  it("displays structured error card and stops loading when metadataError is set", () => {
    useReplayStore.getState().setMetadataError("API 404 /api/replay/2026/Singapore/R/metadata: Telemetry unavailable");
    render(<ReplayCanvas />);

    // Should NOT show the loading spinner text
    expect(screen.queryByText("Loading circuit data…")).not.toBeInTheDocument();

    // Should display error title and explanation
    expect(screen.getByText("Real Telemetry Unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Formula 1 restricted unauthenticated access/i)).toBeInTheDocument();

    // Should provide action buttons
    const demoBtn = screen.getByRole("button", { name: /Launch Demo Replay/i });
    expect(demoBtn).toBeInTheDocument();

    fireEvent.click(demoBtn);
    expect(mockPush).toHaveBeenCalledWith("/replay/0/Demo%20Grand%20Prix/R");
  });

  it("navigates back to race selector when clicking Change Race in error card", () => {
    useReplayStore.getState().setMetadataError("API 404: Telemetry unavailable");
    render(<ReplayCanvas />);

    const changeRaceBtn = screen.getByRole("button", { name: /Change Race/i });
    expect(changeRaceBtn).toBeInTheDocument();

    fireEvent.click(changeRaceBtn);
    expect(mockPush).toHaveBeenCalledWith("/");
  });
});
