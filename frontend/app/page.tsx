"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Flag, Play, Sparkles, Activity } from "lucide-react";
import Link from "next/link";
import { useSeasonEvents, useLatestAvailableSession } from "@/hooks/useSeasonEvents";
import { LandingHero } from "@/components/landing/LandingHero";
import { FeaturedRaceCard } from "@/components/landing/FeaturedRaceCard";
import { CircuitPreviewCard } from "@/components/landing/CircuitPreviewCard";
import { RecentRoundsGrid } from "@/components/landing/RecentRoundsGrid";
import { SeasonArchiveSelector } from "@/components/landing/SeasonArchiveSelector";
import type { LatestAvailableSessionDTO, SeasonEventDTO } from "@/types/api";

export default function LandingPage() {
  const { data: latestSession, isLoading: isLatestLoading } = useLatestAvailableSession();

  // Active year state (defaults to latest available year or 2024)
  const [selectedYear, setSelectedYear] = useState<number>(2024);

  // Sync selectedYear once latestSession loads if user hasn't explicitly changed it
  useEffect(() => {
    if (latestSession && latestSession.year > 0) {
      setSelectedYear(latestSession.year);
    }
  }, [latestSession]);

  // Selected event for live circuit preview & feature display
  const [previewEvent, setPreviewEvent] = useState<SeasonEventDTO | null>(null);

  const { data: seasonEvents, isLoading: isEventsLoading, isError: isEventsError } = useSeasonEvents(selectedYear);

  // When season changes, select the first available championship round
  useEffect(() => {
    if (seasonEvents && seasonEvents.length > 0) {
      const firstReal = seasonEvents.find((e) => e.roundNumber > 0 && e.status !== "restricted") || seasonEvents[0];
      setPreviewEvent(firstReal);
    }
  }, [seasonEvents]);

  // Compute active featured session
  const activeFeaturedSession: LatestAvailableSessionDTO = useMemo(() => {
    if (previewEvent) {
      return {
        year: selectedYear,
        event: previewEvent.eventName,
        sessionType: "R",
        roundNumber: previewEvent.roundNumber,
        eventName: previewEvent.eventName,
        country: previewEvent.country,
        location: previewEvent.location,
        eventDate: previewEvent.eventDate,
        isDemo: selectedYear === 0,
        hasTelemetry: previewEvent.hasTelemetry ?? true,
        status: previewEvent.status ?? "available",
      };
    }
    if (latestSession) {
      return latestSession;
    }
    return {
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
  }, [previewEvent, latestSession, selectedYear]);

  const archiveSectionRef = useRef<HTMLDivElement>(null);

  const handleScrollToArchive = () => {
    const el = document.getElementById("season-archive");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-pitwall-canvas text-pitwall-text selection:bg-pitwall-signal selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-pitwall-hairline bg-pitwall-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white hover:opacity-90">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pitwall-signal shadow-md shadow-pitwall-signal/30">
              <Flag className="h-4 w-4 text-white" />
            </span>
            <span>F1 RACE REPLAY</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/replay/demo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              <Play className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>Instant Demo</span>
            </Link>

            <button
              type="button"
              onClick={handleScrollToArchive}
              className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-pitwall-text-muted hover:text-white transition-colors"
            >
              <span>Seasons</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <LandingHero onExploreClick={handleScrollToArchive} />

      {/* Main Interactive Workbench Section */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
        {/* Showcase Grid: Featured Race & Live Circuit Vector Preview */}
        <section aria-label="Featured Race & Circuit Preview" className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-pitwall-telemetry" />
            <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
              Race Center & Live Circuit
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col">
              <FeaturedRaceCard
                session={activeFeaturedSession}
                isLoading={isLatestLoading && !previewEvent}
              />
            </div>

            <div className="lg:col-span-5 flex flex-col">
              <CircuitPreviewCard
                eventName={activeFeaturedSession.eventName}
                country={activeFeaturedSession.country}
                location={activeFeaturedSession.location}
                roundNumber={activeFeaturedSession.roundNumber}
                className="h-full flex flex-col justify-between"
              />
            </div>
          </div>
        </section>

        {/* Recent Rounds Grid */}
        <section aria-label="Recent Grand Prix Rounds">
          <RecentRoundsGrid
            year={selectedYear}
            events={seasonEvents}
            isLoading={isEventsLoading}
            onSelectEvent={(evName) => {
              const ev = seasonEvents?.find((e) => e.eventName === evName);
              if (ev) setPreviewEvent(ev);
            }}
          />
        </section>

        {/* Season Archive and Full Race Discovery */}
        <section aria-label="Historical Season Archive" ref={archiveSectionRef}>
          <SeasonArchiveSelector
            selectedYear={selectedYear}
            onYearChange={(newYear) => {
              setSelectedYear(newYear);
              setPreviewEvent(null);
            }}
            events={seasonEvents}
            isLoading={isEventsLoading}
            isError={isEventsError}
            selectedEventName={activeFeaturedSession.eventName}
            onSelectEvent={(ev) => setPreviewEvent(ev)}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-pitwall-hairline bg-pitwall-dock/90 py-10 text-xs text-pitwall-text-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display text-sm font-semibold text-pitwall-text">
            <Activity className="h-4 w-4 text-pitwall-signal" />
            <span>F1 Race Replay — Pit Wall Engineering Platform</span>
          </div>

          <p className="text-center sm:text-right text-[11px] text-pitwall-text-muted/70 max-w-md leading-relaxed">
            Non-commercial open-source motorsport analytics and telemetry simulation. Formula 1, F1, and related marks are trademarks of Formula One Licensing B.V.
          </p>
        </div>
      </footer>
    </div>
  );
}
