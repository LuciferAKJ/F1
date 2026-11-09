import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnalyticsDashboard } from "../AnalyticsDashboard";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import type { RaceIntelligence } from "@/lib/raceIntelligence";

// Mock Recharts responsive container & charts for jsdom
vi.mock("recharts", async () => {
  const original = await vi.importActual<Record<string, unknown>>("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 300 }}>
        {children}
      </div>
    ),
  };
});

// Mock useDriverSeries
vi.mock("@/hooks/useDriverSeries", () => ({
  useDriverSeries: vi.fn((race, driverAbbr) => {
    if (!driverAbbr) return { series: [], isLoading: false, isError: false };
    return {
      series: [
        { t: 0, speed: 200, throttle: 80, brake: 0, rpm: 10500, gear: 5, drs: 0, lap: 1, sector: 1, tyre: "MEDIUM" },
        { t: 10, speed: 310, throttle: 100, brake: 0, rpm: 11800, gear: 7, drs: 12, lap: 1, sector: 2, tyre: "MEDIUM" },
        { t: 20, speed: 120, throttle: 20, brake: 100, rpm: 8000, gear: 3, drs: 0, lap: 1, sector: 3, tyre: "MEDIUM" },
        { t: 90, speed: 210, throttle: 85, brake: 0, rpm: 10600, gear: 5, drs: 0, lap: 2, sector: 1, tyre: "HARD" },
        { t: 180, speed: 315, throttle: 100, brake: 0, rpm: 11900, gear: 8, drs: 12, lap: 2, sector: 2, tyre: "HARD" },
      ],
      isLoading: false,
      isError: false,
    };
  }),
}));

const mockRace: SelectedRace = {
  year: 2024,
  event: "Bahrain",
  sessionType: "R",
};

const mockIntelligence: RaceIntelligence = {
  overtakes: [
    {
      id: "ot-1",
      timestamp: 15.5,
      lap: 1,
      gainedBy: "VER",
      lostBy: "NOR",
      positionsGained: 1,
      resultingPosition: 1,
    },
  ],
  fastestLaps: [
    {
      id: "fl-1",
      timestamp: 95.0,
      lap: 2,
      driver: "LEC",
      lapTime: 92.412,
    },
  ],
  positionHistoryByDriver: new Map(),
  currentFastestLapHolder: "LEC",
};

describe("Interactive Analytics Workbench", () => {
  beforeEach(() => {
    useReplayStore.setState({
      selectedRace: mockRace,
      selectedDriver: "VER",
      currentTimestamp: 10.0,
      currentLap: 1,
      playing: false,
      playbackSpeed: 1,
      metadata: {
        info: {
          year: 2024,
          event: "Bahrain",
          sessionType: "R",
          sessionName: "Grand Prix",
          totalLaps: 57,
        },
        drivers: [
          { abbreviation: "VER", teamName: "Red Bull Racing", teamColor: "#3671C6", driverNumber: "1" },
          { abbreviation: "NOR", teamName: "McLaren", teamColor: "#FF8000", driverNumber: "4" },
          { abbreviation: "LEC", teamName: "Ferrari", teamColor: "#E80020", driverNumber: "16" },
        ],
        circuit: { x: [], y: [], minX: 0, maxX: 100, minY: 0, maxY: 100 },
        totalLaps: 57,
        duration: 5400,
        frameInterval: 0.5,
        frameCount: 10800,
      },
      currentFrame: {
        timestamp: 10.0,
        lap: 1,
        drivers: [
          {
            driverId: "VER",
            x: 0,
            y: 0,
            speed: 310,
            gear: 7,
            throttle: 100,
            brake: false,
            rpm: 11800,
            drs: 12,
            tyre: "MEDIUM",
            lap: 1,
            sector: 2,
            position: 1,
          },
          {
            driverId: "NOR",
            x: 0,
            y: 0,
            speed: 290,
            gear: 6,
            throttle: 90,
            brake: true,
            rpm: 10500,
            drs: 0,
            tyre: "SOFT",
            lap: 1,
            sector: 2,
            position: 2,
          },
        ],
      },
    });
  });

  it("renders the workbench shell with all 4 required tabs and driver badge", () => {
    const handleSeek = vi.fn();
    render(
      <AnalyticsDashboard
        race={mockRace}
        onSeek={handleSeek}
        intelligence={mockIntelligence}
      />
    );

    expect(screen.getByText("ANALYTICS WORKBENCH")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /TELEMETRY/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /LAP COMPARISON/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /RACE CONTROL/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /STRATEGY/i })).toBeInTheDocument();
    expect(screen.getAllByText("VER").length).toBeGreaterThan(0);
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("renders Telemetry tab with channel visibility toggles and speed chart", () => {
    const handleSeek = vi.fn();
    render(
      <AnalyticsDashboard
        race={mockRace}
        onSeek={handleSeek}
        intelligence={mockIntelligence}
      />
    );

    // Initial tab is TELEMETRY
    expect(screen.getByText("SPEED")).toBeInTheDocument();
    expect(screen.getByText("THROTTLE")).toBeInTheDocument();
    expect(screen.getByText("BRAKE (BINARY)")).toBeInTheDocument();
    expect(screen.getByText("RPM")).toBeInTheDocument();
    expect(screen.getByText("GEAR")).toBeInTheDocument();

    // Verify unavailable channel truth disclosures
    expect(screen.getByText("ERS Energy Deployment")).toBeInTheDocument();
    expect(screen.getByText("Friction Circle / G-Force")).toBeInTheDocument();
  });

  it("switches to Lap Comparison tab immediately and displays lap delta analysis", () => {
    const handleSeek = vi.fn();
    render(
      <AnalyticsDashboard
        race={mockRace}
        onSeek={handleSeek}
        intelligence={mockIntelligence}
      />
    );

    const lapTab = screen.getByRole("tab", { name: /LAP COMPARISON/i });
    fireEvent.click(lapTab);

    expect(screen.getByText(/Driver:/i)).toBeInTheDocument();
    expect(screen.getByText(/2 laps recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/SPEED TRACE OVERLAY/i)).toBeInTheDocument();
    expect(screen.getByText(/Lap Time Delta/i)).toBeInTheDocument();
  });

  it("switches to Race Control tab and supports event filtering and click-to-seek", () => {
    const handleSeek = vi.fn();
    render(
      <AnalyticsDashboard
        race={mockRace}
        onSeek={handleSeek}
        intelligence={mockIntelligence}
      />
    );

    const raceControlTab = screen.getByRole("tab", { name: /RACE CONTROL/i });
    fireEvent.click(raceControlTab);

    // Verify overtake event
    expect(screen.getByText("P1 OVERTAKE")).toBeInTheDocument();
    expect(screen.getByText(/VER passed NOR for position P1/i)).toBeInTheDocument();

    // Verify fastest lap event
    expect(screen.getByText("NEW FASTEST LAP")).toBeInTheDocument();
    expect(screen.getByText(/LEC clocked/i)).toBeInTheDocument();

    // Click on the overtake event to trigger seek
    const overtakeRow = screen.getByText("P1 OVERTAKE").closest("div");
    if (overtakeRow) {
      fireEvent.click(overtakeRow);
      expect(handleSeek).toHaveBeenCalledWith(15.5);
    }
  });

  it("switches to Strategy tab and renders field tyre matrix and estimated tyre age", () => {
    const handleSeek = vi.fn();
    render(
      <AnalyticsDashboard
        race={mockRace}
        onSeek={handleSeek}
        intelligence={mockIntelligence}
      />
    );

    const strategyTab = screen.getByRole("tab", { name: /STRATEGY/i });
    fireEvent.click(strategyTab);

    expect(screen.getByText("Field Tyre & Stint Matrix")).toBeInTheDocument();
    expect(screen.getByText("Spotlight Driver")).toBeInTheDocument();
    expect(screen.getByText("Estimated Tyre Age")).toBeInTheDocument();
    expect(screen.getByText("Tyre Degradation Curves")).toBeInTheDocument();
    expect(screen.getByText("Pit Window Forecasting")).toBeInTheDocument();
  });

  it("toggles workbench expansion when collapse button is clicked", () => {
    const handleSeek = vi.fn();
    render(
      <AnalyticsDashboard
        race={mockRace}
        onSeek={handleSeek}
        intelligence={mockIntelligence}
      />
    );

    const toggleBtn = screen.getByLabelText("Toggle analytics workbench");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  });
});

