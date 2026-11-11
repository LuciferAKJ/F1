"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Flag, Play, Sparkles, Activity } from "lucide-react";
import Link from "next/link";
import {
  useSeasonEvents,
  useLatestAvailableSession,
  useVerifySessionAvailability,
} from "@/hooks/useSeasonEvents";
import { LandingHero } from "@/components/landing/LandingHero";
import { FeaturedRaceCard } from "@/components/landing/FeaturedRaceCard";
import { CircuitPreviewCard } from "@/components/landing/CircuitPreviewCard";
import { RecentRoundsGrid } from "@/components/landing/RecentRoundsGrid";
import { SeasonArchiveSelector } from "@/components/landing/SeasonArchiveSelector";
import { isSessionPlayable } from "@/components/landing/availabilityUtils";
import type { LatestAvailableSessionDTO, SeasonEventDTO } from "@/types/api";

export default function LandingPage() {
  const {
    data: latestSession,
    isLoading: isLatestLoading,
    isError: isLatestError,
  } = useLatestAvailableSession();

  // Dynamic initial season without hardcoded year cap
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [sessionType, setSessionType] = useState<string>("R");
  const [selectedEventName, setSelectedEventName] = useState<string | null>(null);
  const [verifyingEvent, setVerifyingEvent] = useState<string | null>(null);

  // Guards against background latestSession load overwriting user selection
  const userChangedSelectionRef = useRef(false);

  useEffect(() => {
    if (!userChangedSelectionRef.current && latestSession && latestSession.year > 0) {
      setSelectedYear(latestSession.year);
      if (latestSession.sessionType) {
        setSessionType(latestSession.sessionType);
      }
    }
  }, [latestSession]);

  const {
    data: seasonEvents,
    isLoading: isEventsLoading,
    isError: isEventsError,
  } = useSeasonEvents(selectedYear, sessionType);

  const verifyMutation = useVerifySessionAvailability();

  const handleVerifyEvent = (eventName: string, targetSessionType: string) => {
    setVerifyingEvent(eventName);
    verifyMutation.mutate(
      { year: selectedYear, event: eventName, sessionType: targetSessionType },
      {
        onSettled: () => setVerifyingEvent(null),
      }
    );
  };

  // Resolve the currently focused event from live seasonEvents query data
  const selectedEvent: SeasonEventDTO | null = useMemo(() => {
    if (!seasonEvents || seasonEvents.length === 0) return null;

    if (selectedEventName) {
      const exactMatch = seasonEvents.find((e) => e.eventName === selectedEventName);
      if (exactMatch) return exactMatch;
    }

    // If the user explicitly changed year/session without clicking a specific race yet,
    // pick the best representative round in that season.
    if (userChangedSelectionRef.current) {
      return (
        seasonEvents.find(isSessionPlayable) ||
        seasonEvents.find((e) => e.roundNumber > 0 && e.status !== "restricted") ||
        seasonEvents[0]
      );
    }

    return null;
  }, [seasonEvents, selectedEventName]);

  // Compute featured session strictly from verified/discovered state (never hardcoded Bahrain)
  const activeFeaturedSession: LatestAvailableSessionDTO | null = useMemo(() => {
    if (selectedEvent) {
      const evSessionType = selectedEvent.sessionType || sessionType;
      return {
        year: selectedYear,
        event: selectedEvent.eventName,
        sessionType: evSessionType,
        roundNumber: selectedEvent.roundNumber,
        eventName: selectedEvent.eventName,
        country: selectedEvent.country,
        location: selectedEvent.location,
        eventDate: selectedEvent.eventDate,
        isDemo: selectedYear === 0,
        hasVerifiedRealSession: isSessionPlayable(selectedEvent),
        hasTelemetry: selectedEvent.hasTelemetry,
        verified: selectedEvent.verified,
        status: selectedEvent.status,
        totalLaps: selectedEvent.totalLaps ?? null,
        driverCount: selectedEvent.driverCount ?? null,
        circuit: selectedEvent.circuit ?? null,
        statusReason: selectedEvent.statusReason ?? null,
      };
    }

    if (latestSession) {
      return latestSession;
    }

    return null;
  }, [selectedEvent, latestSession, selectedYear, sessionType]);

  const handleSelectEvent = (ev: SeasonEventDTO) => {
    userChangedSelectionRef.current = true;
    setSelectedEventName(ev.eventName);
  };

  const handleYearChange = (newYear: number) => {
    userChangedSelectionRef.current = true;
    setSelectedYear(newYear);
    setSelectedEventName(null);
  };

  const handleSessionTypeChange = (nextSession: string) => {
    userChangedSelectionRef.current = true;
    setSessionType(nextSession);
  };

  const handleScrollToArchive = () => {
    const el = document.getElementById("season-archive");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const isFeaturedLoading =
    !selectedEvent && !latestSession && (isLatestLoading || isEventsLoading);

  return (
    <div className="min-h-screen bg-pitwall-canvas text-pitwall-text selection:bg-pitwall-signal selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-pitwall-hairline bg-pitwall-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white hover:opacity-90"
          >
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
        {/* Showcase Grid: Featured Race & Circuit Preview */}
        <section aria-label="Featured Race & Circuit Preview" className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-pitwall-telemetry" />
            <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
              Race Center &amp; Circuit Preview
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col">
              <FeaturedRaceCard
                session={activeFeaturedSession}
                isLoading={isFeaturedLoading}
                isError={isLatestError && isEventsError}
                isVerifying={
                  activeFeaturedSession !== null &&
                  verifyingEvent === activeFeaturedSession.eventName
                }
                onVerifySession={
                  activeFeaturedSession && activeFeaturedSession.status === "unverified"
                    ? () =>
                        handleVerifyEvent(
                          activeFeaturedSession.eventName,
                          activeFeaturedSession.sessionType
                        )
                    : undefined
                }
              />
            </div>

            <div className="lg:col-span-5 flex flex-col">
              <CircuitPreviewCard
                eventName={activeFeaturedSession?.eventName ?? "No Session Selected"}
                country={activeFeaturedSession?.country ?? ""}
                location={activeFeaturedSession?.location ?? ""}
                roundNumber={activeFeaturedSession?.roundNumber}
                totalLaps={activeFeaturedSession?.totalLaps}
                driverCount={activeFeaturedSession?.driverCount}
                circuit={activeFeaturedSession?.circuit}
                isDemo={activeFeaturedSession?.isDemo}
                className="h-full flex flex-col justify-between"
              />
            </div>
          </div>
        </section>

        {/* Recent Rounds Grid */}
        <section aria-label="Recent Grand Prix Rounds">
          <RecentRoundsGrid
            year={selectedYear}
            sessionType={sessionType}
            events={seasonEvents}
            isLoading={isEventsLoading}
            verifyingEvent={verifyingEvent}
            onSelectEvent={handleSelectEvent}
            onVerifyEvent={handleVerifyEvent}
          />
        </section>

        {/* Season Archive and Full Race Discovery */}
        <section aria-label="Historical Season Archive">
          <SeasonArchiveSelector
            selectedYear={selectedYear}
            onYearChange={handleYearChange}
            sessionType={sessionType}
            onSessionTypeChange={handleSessionTypeChange}
            events={seasonEvents}
            isLoading={isEventsLoading}
            isError={isEventsError}
            verifyingEvent={verifyingEvent}
            selectedEventName={activeFeaturedSession?.eventName}
            onSelectEvent={handleSelectEvent}
            onVerifyEvent={handleVerifyEvent}
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
