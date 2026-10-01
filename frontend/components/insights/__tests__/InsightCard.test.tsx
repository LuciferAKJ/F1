import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { InsightCard } from "../InsightCard";
import type { Insight } from "@/lib/raceInsights";

describe("InsightCard", () => {
  const mockInsight: Insight = {
    id: "insight-1",
    category: "overtake",
    severity: "high",
    title: "VER overtakes HAM into Turn 1",
    description: "Max Verstappen made a late dive on the brakes into Turn 1.",
    timestamp: 75.5,
    lap: 3,
    drivers: ["VER", "HAM"],
  };

  it("renders insight title, lap, description and formatted timestamp", () => {
    const onSelect = vi.fn();
    render(<InsightCard insight={mockInsight} onSelect={onSelect} />);

    expect(screen.getByText("VER overtakes HAM into Turn 1")).toBeInTheDocument();
    expect(screen.getByText("Lap 3")).toBeInTheDocument();
    expect(screen.getByText("1:15")).toBeInTheDocument();
    expect(screen.getByText("Max Verstappen made a late dive on the brakes into Turn 1.")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<InsightCard insight={mockInsight} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockInsight);
  });
});
