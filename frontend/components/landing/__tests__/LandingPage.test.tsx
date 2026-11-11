import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const mockUseLatestAvailableSession = vi.fn();
const mockUseSeasonEvents = vi.fn();
const mockMutate = vi.fn();

vi.mock("@/hooks/useSeasonEvents", () => ({
  useLatestAvailableSession: () => mockUseLatestAvailableSession(),
  useSeasonEvents: (year: number | null, sessionType?: string) =>
    mockUseSeasonEvents(year, sessionType),
  useVerifySessionAvailability: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

import LandingPage from "@/app/page";
import type { LatestAvailableSessionDTO, SeasonEventDTO } from "@/types/api";

const MOCK_2025_EVENTS: SeasonEventDTO[] = [
  {
    roundNumber: 1,
    eventName: "Japanese Grand Prix",
    country: "Japan",
    location: "Suzuka",
    eventDate: "2025-04-06",
    sessionType: "R",
    status: "unverified",
    hasTelemetry: false,
    verified: false,
    verifiedSessions: [],
  },
];

const MOCK_CURRENT_EVENTS: SeasonEventDTO[] = [
  {
    roundNumber: 1,
    eventName: "Australian Grand Prix",
    country: "Australia",
    location: "Melbourne",
    eventDate: "2026-03-08",
    sessionType: "R",
    status: "unverified",
    hasTelemetry: false,
    verified: false,
    verifiedSessions: [],
  },
];

describe("LandingPage Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never falls back to hardcoded 2024 Bahrain Grand Prix when API errors", () => {
    mockUseLatestAvailableSession.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    mockUseSeasonEvents.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<LandingPage />);

    expect(screen.getByTestId("featured-race-fallback")).toBeInTheDocument();
    expect(screen.queryByText(/Bahrain Grand Prix/i)).not.toBeInTheDocument();
  });

  it("displays explicit Sample Demo Data when backend returns demo fallback", () => {
    const demoSession: LatestAvailableSessionDTO = {
      year: 0,
      event: "Demo",
      sessionType: "R",
      roundNumber: 0,
      eventName: "Demo Grand Prix",
      country: "Sample Circuit",
      location: "Simulation",
      eventDate: "",
      isDemo: true,
      hasVerifiedRealSession: false,
      hasTelemetry: true,
      verified: true,
      status: "available",
      totalLaps: 57,
      driverCount: 3,
    };

    mockUseLatestAvailableSession.mockReturnValue({
      data: demoSession,
      isLoading: false,
      isError: false,
    });
    mockUseSeasonEvents.mockReturnValue({
      data: MOCK_CURRENT_EVENTS,
      isLoading: false,
      isError: false,
    });

    render(<LandingPage />);

    expect(screen.getByText(/SAMPLE DEMO DATA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Demo Grand Prix/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Australian Grand Prix/i).length).toBeGreaterThanOrEqual(1);
  });

  it("preserves user-selected event if latestSession resolves later in the background", () => {
    mockUseLatestAvailableSession.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    mockUseSeasonEvents.mockImplementation((year: number | null) => {
      if (year === 2025) {
        return { data: MOCK_2025_EVENTS, isLoading: false, isError: false };
      }
      return { data: MOCK_CURRENT_EVENTS, isLoading: false, isError: false };
    });

    const { rerender } = render(<LandingPage />);

    // User clicks Australian Grand Prix while latestSession is still loading
    const eventButtons = screen.getAllByRole("button", { name: "Australian Grand Prix" });
    fireEvent.click(eventButtons[0]);

    expect(screen.getByTestId("featured-race-card")).toHaveTextContent("Australian Grand Prix");

    // Later, background latestSession resolves to Azerbaijan 2026
    mockUseLatestAvailableSession.mockReturnValue({
      data: {
        year: 2026,
        event: "Azerbaijan Grand Prix",
        sessionType: "R",
        roundNumber: 17,
        eventName: "Azerbaijan Grand Prix",
        country: "Azerbaijan",
        location: "Baku",
        eventDate: "2026-09-26",
        isDemo: false,
        hasVerifiedRealSession: true,
        hasTelemetry: true,
        verified: true,
        status: "available",
      },
      isLoading: false,
      isError: false,
    });

    rerender(<LandingPage />);

    // User's selected event remains active and was NOT overwritten
    expect(screen.getByTestId("featured-race-card")).toHaveTextContent("Australian Grand Prix");
  });
});

