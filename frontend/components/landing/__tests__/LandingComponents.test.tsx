import { describe, it, expect, vi } from "vitest";
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
import type { SeasonEventDTO, LatestAvailableSessionDTO } from "@/types/api";

const MOCK_EVENTS: SeasonEventDTO[] = [
  {
    roundNumber: 0,
    eventName: "Pre-Season Testing",
    country: "Bahrain",
    location: "Sakhir",
    eventDate: "2024-02-23",
    status: "restricted",
    hasTelemetry: false,
  },
  {
    roundNumber: 1,
    eventName: "Bahrain Grand Prix",
    country: "Bahrain",
    location: "Sakhir",
    eventDate: "2024-03-02",
    status: "available",
    hasTelemetry: true,
  },
  {
    roundNumber: 2,
    eventName: "Saudi Arabian Grand Prix",
    country: "Saudi Arabia",
    location: "Jeddah",
    eventDate: "2024-03-09",
    status: "available",
    hasTelemetry: true,
  },
  {
    roundNumber: 3,
    eventName: "Australian Grand Prix",
    country: "Australia",
    location: "Melbourne",
    eventDate: "2024-03-24",
    status: "upcoming",
    hasTelemetry: false,
  },
];

const MOCK_LATEST_SESSION: LatestAvailableSessionDTO = {
  year: 2024,
  event: "Bahrain Grand Prix",
  sessionType: "R",
  roundNumber: 1,
  eventName: "Bahrain Grand Prix",
  country: "Bahrain",
  location: "Sakhir",
  eventDate: "2024-03-02",
  isDemo: false,
  hasTelemetry: true,
  status: "available",
};

describe("LandingPage Components", () => {
  describe("LandingHero", () => {
    it("renders headline, status badge and primary CTAs", () => {
      const onExplore = vi.fn();
      render(<LandingHero onExploreClick={onExplore} />);

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Formula 1 Race Replay/i);
      expect(screen.getByText(/Reimagined for Spectators/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Watch Instant Demo/i })).toHaveAttribute("href", "/replay/demo");

      const exploreBtn = screen.getByRole("button", { name: /Explore Races & Seasons/i });
      fireEvent.click(exploreBtn);
      expect(onExplore).toHaveBeenCalledTimes(1);
    });
  });

  describe("FeaturedRaceCard", () => {
    it("renders featured race information, status badges and launch link", () => {
      render(<FeaturedRaceCard session={MOCK_LATEST_SESSION} />);

      expect(screen.getByTestId("featured-race-card")).toBeInTheDocument();
      expect(screen.getByText(/FEATURED GRAND PRIX/i)).toBeInTheDocument();
      expect(screen.getByText("Bahrain Grand Prix")).toBeInTheDocument();
      expect(screen.getByText(/REPLAY VERIFIED/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Launch Race Replay/i })).toHaveAttribute(
        "href",
        "/replay/2024/Bahrain%20Grand%20Prix/R"
      );
    });

    it("renders loading skeleton when isLoading is true", () => {
      render(<FeaturedRaceCard session={null} isLoading={true} />);
      expect(screen.getByTestId("featured-race-skeleton")).toBeInTheDocument();
    });
  });

  describe("CircuitPreviewCard", () => {
    it("renders circuit details, SVG map, turns, and DRS zones", () => {
      render(
        <CircuitPreviewCard
          eventName="Bahrain Grand Prix"
          country="Bahrain"
          location="Sakhir"
          roundNumber={1}
          totalLaps={57}
        />
      );

      expect(screen.getByTestId("circuit-preview-card")).toBeInTheDocument();
      expect(screen.getByText(/Bahrain International Circuit/i)).toBeInTheDocument();
      expect(screen.getByText("ROUND 1")).toBeInTheDocument();
      expect(screen.getByText("5.412 km")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument(); // 15 turns
      expect(screen.getByText("3")).toBeInTheDocument(); // 3 DRS zones
      expect(screen.getByText("57")).toBeInTheDocument(); // 57 laps
    });
  });

  describe("RecentRoundsGrid", () => {
    it("renders recent championship rounds and filters out testing", () => {
      render(<RecentRoundsGrid year={2024} events={MOCK_EVENTS} />);

      expect(screen.getByTestId("recent-rounds-grid")).toBeInTheDocument();
      expect(screen.getByText("Bahrain Grand Prix")).toBeInTheDocument();
      expect(screen.getByText("Saudi Arabian Grand Prix")).toBeInTheDocument();
      expect(screen.getByText("Australian Grand Prix")).toBeInTheDocument();
      // Pre-season testing (roundNumber: 0) should not be shown
      expect(screen.queryByText("Pre-Season Testing")).not.toBeInTheDocument();
    });
  });

  describe("SeasonArchiveSelector", () => {
    it("renders event list with status badges and filters on search", () => {
      const onYearChange = vi.fn();
      const onSelectEvent = vi.fn();

      render(
        <SeasonArchiveSelector
          selectedYear={2024}
          onYearChange={onYearChange}
          events={MOCK_EVENTS}
          onSelectEvent={onSelectEvent}
          selectedEventName="Bahrain Grand Prix"
        />
      );

      expect(screen.getByTestId("season-archive-selector")).toBeInTheDocument();
      expect(screen.getByText("Bahrain Grand Prix")).toBeInTheDocument();
      expect(screen.getByText("Saudi Arabian Grand Prix")).toBeInTheDocument();

      // Test Search filtering
      const searchInput = screen.getByLabelText(/Filter Grand Prix events/i);
      fireEvent.change(searchInput, { target: { value: "Saudi" } });

      expect(screen.getByText("Saudi Arabian Grand Prix")).toBeInTheDocument();
      expect(screen.queryByText("Bahrain Grand Prix")).not.toBeInTheDocument();

      // Test empty search state
      fireEvent.change(searchInput, { target: { value: "NonExistentGrandPrix" } });
      expect(screen.getByTestId("archive-empty-state")).toBeInTheDocument();
      expect(screen.getByText(/No Grand Prix Found/i)).toBeInTheDocument();
    });
  });
});
