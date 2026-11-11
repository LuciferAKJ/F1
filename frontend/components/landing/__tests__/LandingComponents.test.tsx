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

import { LandingHero } from "../LandingHero";
import { FeaturedRaceCard } from "../FeaturedRaceCard";
import { CircuitPreviewCard } from "../CircuitPreviewCard";
import { RecentRoundsGrid } from "../RecentRoundsGrid";
import { SeasonArchiveSelector } from "../SeasonArchiveSelector";
import { isSessionPlayable, getStatusDisplay } from "../availabilityUtils";
import type { SeasonEventDTO, LatestAvailableSessionDTO } from "@/types/api";

const MOCK_CIRCUIT = {
  x: [0, 100, 100, 0],
  y: [0, 0, 100, 100],
  minX: 0,
  maxX: 100,
  minY: 0,
  maxY: 100,
  rotation: 0,
  marshalSectors: [],
};

const MOCK_EVENTS: SeasonEventDTO[] = [
  {
    roundNumber: 0,
    eventName: "Pre-Season Testing",
    country: "Bahrain",
    location: "Sakhir",
    eventDate: "2026-02-20",
    sessionType: "R",
    status: "restricted",
    hasTelemetry: false,
    verified: true,
    verifiedSessions: [],
    statusReason: "Testing session without championship race telemetry",
  },
  {
    roundNumber: 1,
    eventName: "Australian Grand Prix",
    country: "Australia",
    location: "Melbourne",
    eventDate: "2026-03-08",
    sessionType: "R",
    status: "available",
    hasTelemetry: true,
    verified: true,
    verifiedSessions: ["R"],
    totalLaps: 58,
    driverCount: 20,
    circuit: MOCK_CIRCUIT,
  },
  {
    roundNumber: 2,
    eventName: "Chinese Grand Prix",
    country: "China",
    location: "Shanghai",
    eventDate: "2026-03-15",
    sessionType: "R",
    status: "unverified",
    hasTelemetry: false,
    verified: false,
    verifiedSessions: [],
    statusReason: "Session has not been verified or cached yet",
  },
  {
    roundNumber: 20,
    eventName: "Qatar Grand Prix",
    country: "Qatar",
    location: "Lusail",
    eventDate: "2026-11-29",
    sessionType: "R",
    status: "upcoming",
    hasTelemetry: false,
    verified: true,
    verifiedSessions: [],
    statusReason: "Scheduled for 2026-11-29",
  },
];

const MOCK_VERIFIED_SESSION: LatestAvailableSessionDTO = {
  year: 2026,
  event: "Australian Grand Prix",
  sessionType: "R",
  roundNumber: 1,
  eventName: "Australian Grand Prix",
  country: "Australia",
  location: "Melbourne",
  eventDate: "2026-03-08",
  isDemo: false,
  hasVerifiedRealSession: true,
  hasTelemetry: true,
  verified: true,
  status: "available",
  totalLaps: 58,
  driverCount: 20,
  circuit: MOCK_CIRCUIT,
};

describe("availabilityUtils", () => {
  it("never marks unverified, missing status, or hasTelemetry=false as playable", () => {
    expect(isSessionPlayable({ status: "available", hasTelemetry: true, verified: true })).toBe(true);
    expect(isSessionPlayable({ status: "available", hasTelemetry: false, verified: true })).toBe(false);
    expect(isSessionPlayable({ status: "available", hasTelemetry: true, verified: false })).toBe(false);
    expect(isSessionPlayable({ status: "unverified", hasTelemetry: false, verified: false })).toBe(false);
    expect(isSessionPlayable({ status: "unknown", hasTelemetry: false, verified: false })).toBe(false);

    expect(getStatusDisplay({ status: "unknown", hasTelemetry: false, verified: false }).label).toBe("Unknown");
    expect(getStatusDisplay({ status: "available", hasTelemetry: false, verified: true }).label).toBe("Not Verified");
  });
});

describe("LandingPage Components", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe("LandingHero", () => {
    it("renders spectator copy, Demo CTA with Sample badge, and explore button", () => {
      const onExplore = vi.fn();
      render(<LandingHero onExploreClick={onExplore} />);

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Formula 1 Race Replay/i);
      expect(screen.getByText(/Reimagined for Spectators/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Watch Instant Demo/i })).toHaveAttribute("href", "/replay/demo");
      expect(screen.getByText("Sample")).toBeInTheDocument();
      expect(screen.queryByText(/2024–2025 SEASON READY/i)).not.toBeInTheDocument();

      const exploreBtn = screen.getByRole("button", { name: /Explore Races & Seasons/i });
      fireEvent.click(exploreBtn);
      expect(onExplore).toHaveBeenCalledTimes(1);
    });
  });

  describe("FeaturedRaceCard", () => {
    it("renders verified real race with launch link and verified counts", () => {
      render(<FeaturedRaceCard session={MOCK_VERIFIED_SESSION} />);

      expect(screen.getByTestId("featured-race-card")).toBeInTheDocument();
      expect(screen.getByText(/VERIFIED FEATURED SESSION/i)).toBeInTheDocument();
      expect(screen.getByText("Australian Grand Prix")).toBeInTheDocument();
      expect(screen.getByText(/REPLAY VERIFIED/i)).toBeInTheDocument();
      expect(screen.getByText("20 Drivers")).toBeInTheDocument();
      expect(screen.getByText("58 Laps")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Launch Race Replay/i })).toHaveAttribute(
        "href",
        "/replay/2026/Australian%20Grand%20Prix/R"
      );
    });

    it("renders explicit sample demo labeling without claiming real verified replay", () => {
      render(
        <FeaturedRaceCard
          session={{
            ...MOCK_VERIFIED_SESSION,
            year: 0,
            event: "Demo",
            roundNumber: 0,
            eventName: "Demo Grand Prix",
            country: "Sample Circuit",
            location: "Simulation",
            isDemo: true,
            hasVerifiedRealSession: false,
            driverCount: 3,
            totalLaps: 57,
          }}
        />
      );

      expect(screen.getByText(/SAMPLE DEMO DATA/i)).toBeInTheDocument();
      expect(screen.queryByText(/REPLAY VERIFIED/i)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Launch Sample Demo/i })).toHaveAttribute("href", "/replay/demo");
    });

    it("does not enable replay or show REPLAY VERIFIED for unverified sessions and exposes Check availability", () => {
      const onVerify = vi.fn();
      render(
        <FeaturedRaceCard
          session={{
            ...MOCK_VERIFIED_SESSION,
            event: "Chinese Grand Prix",
            eventName: "Chinese Grand Prix",
            status: "unverified",
            hasTelemetry: false,
            verified: false,
            totalLaps: null,
            driverCount: null,
          }}
          onVerifySession={onVerify}
        />
      );

      expect(screen.queryByText(/REPLAY VERIFIED/i)).not.toBeInTheDocument();
      expect(screen.getByText("NOT VERIFIED")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Launch Race Replay/i })).not.toBeInTheDocument();

      const verifyBtn = screen.getByRole("button", { name: /Check availability/i });
      fireEvent.click(verifyBtn);
      expect(onVerify).toHaveBeenCalledTimes(1);
    });

    it("renders truthful fallback without hardcoded Bahrain GP when session is null", () => {
      render(<FeaturedRaceCard session={null} isLoading={false} isError={true} />);

      expect(screen.getByTestId("featured-race-fallback")).toBeInTheDocument();
      expect(screen.queryByText(/Bahrain Grand Prix/i)).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Watch Demo Grand Prix \(Sample Telemetry\)/i })
      ).toHaveAttribute("href", "/replay/demo");
    });

    it("renders loading skeleton when isLoading is true", () => {
      render(<FeaturedRaceCard session={null} isLoading={true} />);
      expect(screen.getByTestId("featured-race-skeleton")).toBeInTheDocument();
    });
  });

  describe("CircuitPreviewCard", () => {
    it("renders verified circuit SVG and real lap/driver stats when circuit coordinates exist", () => {
      render(
        <CircuitPreviewCard
          eventName="Australian Grand Prix"
          country="Australia"
          location="Melbourne"
          roundNumber={1}
          totalLaps={58}
          driverCount={20}
          circuit={MOCK_CIRCUIT}
        />
      );

      expect(screen.getByTestId("circuit-preview-card")).toBeInTheDocument();
      expect(screen.getByTestId("verified-circuit-svg")).toBeInTheDocument();
      expect(screen.getByText("ROUND 1")).toBeInTheDocument();
      expect(screen.getByText("58")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.queryByText(/FIA Grade 1/i)).not.toBeInTheDocument();
    });

    it("renders neutral unavailable state without invented stats or SVG geometry when circuit data is missing", () => {
      render(
        <CircuitPreviewCard
          eventName="Chinese Grand Prix"
          country="China"
          location="Shanghai"
          roundNumber={2}
          circuit={null}
        />
      );

      expect(screen.getByTestId("circuit-preview-unavailable")).toBeInTheDocument();
      expect(screen.queryByTestId("verified-circuit-svg")).not.toBeInTheDocument();
      expect(screen.queryByText(/FIA Grade 1/i)).not.toBeInTheDocument();
      expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("RecentRoundsGrid", () => {
    it("renders rounds truthfully: Watch Replay only for verified available, Check availability for unverified, and filters testing", () => {
      const onVerifyEvent = vi.fn();
      render(<RecentRoundsGrid year={2026} sessionType="R" events={MOCK_EVENTS} onVerifyEvent={onVerifyEvent} />);

      expect(screen.getByTestId("recent-rounds-grid")).toBeInTheDocument();
      expect(screen.getByText("Australian Grand Prix")).toBeInTheDocument();
      expect(screen.getByText("Chinese Grand Prix")).toBeInTheDocument();
      expect(screen.getByText("Qatar Grand Prix")).toBeInTheDocument();
      expect(screen.queryByText("Pre-Season Testing")).not.toBeInTheDocument();

      // Replay verified link only for Australian GP
      const watchLinks = screen.getAllByRole("link", { name: /Watch Replay/i });
      expect(watchLinks).toHaveLength(1);
      expect(watchLinks[0]).toHaveAttribute("href", "/replay/2026/Australian%20Grand%20Prix/R");

      // Check availability button for unverified Chinese GP
      const verifyBtn = screen.getByRole("button", { name: /Check availability/i });
      fireEvent.click(verifyBtn);
      expect(onVerifyEvent).toHaveBeenCalledWith("Chinese Grand Prix", "R");
    });
  });

  describe("SeasonArchiveSelector", () => {
    it("renders truthful status badges without 2024 star bias, supports search, and checks unverified sessions", () => {
      const onYearChange = vi.fn();
      const onSelectEvent = vi.fn();
      const onVerifyEvent = vi.fn();

      render(
        <SeasonArchiveSelector
          selectedYear={2026}
          onYearChange={onYearChange}
          sessionType="R"
          events={MOCK_EVENTS}
          onSelectEvent={onSelectEvent}
          onVerifyEvent={onVerifyEvent}
          selectedEventName="Australian Grand Prix"
        />
      );

      expect(screen.getByTestId("season-archive-selector")).toBeInTheDocument();
      expect(screen.getByText("Australian Grand Prix")).toBeInTheDocument();
      expect(screen.getByText("Chinese Grand Prix")).toBeInTheDocument();
      expect(screen.getByText("Not Verified")).toBeInTheDocument();
      expect(screen.getByText("Replay Ready")).toBeInTheDocument();
      expect(screen.getAllByText("Upcoming").length).toBeGreaterThanOrEqual(1);

      // Click Launch on verified row
      const launchButtons = screen.getAllByRole("button", { name: /Launch/i });
      expect(launchButtons).toHaveLength(1);
      fireEvent.click(launchButtons[0]);
      expect(mockPush).toHaveBeenCalledWith("/replay/2026/Australian%20Grand%20Prix/R");

      // Click Check availability on unverified row
      const checkBtn = screen.getByRole("button", { name: /Check availability/i });
      fireEvent.click(checkBtn);
      expect(onVerifyEvent).toHaveBeenCalledWith("Chinese Grand Prix", "R");

      // Search filtering
      const searchInput = screen.getByLabelText(/Filter Grand Prix events/i);
      fireEvent.change(searchInput, { target: { value: "Chinese" } });
      expect(screen.getByText("Chinese Grand Prix")).toBeInTheDocument();
      expect(screen.queryByText("Australian Grand Prix")).not.toBeInTheDocument();

      // Empty search state
      fireEvent.change(searchInput, { target: { value: "NonExistentGrandPrix" } });
      expect(screen.getByTestId("archive-empty-state")).toBeInTheDocument();
    });
  });
});
