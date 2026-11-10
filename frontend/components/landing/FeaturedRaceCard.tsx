"use client";

import React from "react";
import Link from "next/link";
import { Play, Calendar, MapPin, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LatestAvailableSessionDTO } from "@/types/api";

interface FeaturedRaceCardProps {
  session: LatestAvailableSessionDTO | null | undefined;
  isLoading?: boolean;
}

export function FeaturedRaceCard({ session, isLoading }: FeaturedRaceCardProps) {
  if (isLoading) {
    return (
      <div
        className="animate-pulse rounded-xl border border-pitwall-hairline bg-pitwall-dock/80 p-6 md:p-8"
        data-testid="featured-race-skeleton"
      >
        <div className="h-4 w-32 rounded bg-pitwall-surface" />
        <div className="mt-4 h-8 w-3/4 rounded bg-pitwall-surface" />
        <div className="mt-3 h-4 w-1/2 rounded bg-pitwall-surface" />
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="h-16 rounded bg-pitwall-surface" />
          <div className="h-16 rounded bg-pitwall-surface" />
          <div className="h-16 rounded bg-pitwall-surface" />
        </div>
      </div>
    );
  }

  // Fallback if session is null/empty
  const activeSession: LatestAvailableSessionDTO = session ?? {
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

  const replayHref = activeSession.isDemo
    ? "/replay/demo"
    : `/replay/${activeSession.year}/${encodeURIComponent(activeSession.event)}/${activeSession.sessionType || "R"}`;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-pitwall-hairline bg-gradient-to-br from-pitwall-dock via-pitwall-dock/90 to-pitwall-surface p-6 md:p-8 shadow-2xl"
      data-testid="featured-race-card"
    >
      {/* Top Banner Tag */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pitwall-hairline/70 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded bg-pitwall-signal/15 px-2.5 py-0.5 font-mono text-xs font-bold text-pitwall-signal border border-pitwall-signal/30">
            <Sparkles className="h-3 w-3" />
            FEATURED GRAND PRIX
          </span>
          <span className="font-mono text-xs text-pitwall-text-muted">
            {activeSession.year} · ROUND {activeSession.roundNumber || 1}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-pitwall-drs/10 px-3 py-1 font-mono text-xs font-semibold text-pitwall-drs border border-pitwall-drs/30">
          <span className="h-2 w-2 rounded-full bg-pitwall-drs animate-ping" />
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>REPLAY VERIFIED</span>
        </div>
      </div>

      {/* Main Race Title & Details */}
      <div className="mt-5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          {activeSession.eventName || activeSession.event}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-pitwall-text-muted">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-pitwall-signal" />
            <span>{activeSession.location ? `${activeSession.location}, ${activeSession.country}` : activeSession.country}</span>
          </span>
          {activeSession.eventDate && (
            <span className="flex items-center gap-1.5 font-mono">
              <Calendar className="h-4 w-4 text-pitwall-telemetry" />
              <span>{activeSession.eventDate}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 font-mono">
            <Gauge className="h-4 w-4 text-amber-400" />
            <span>Race Session (R)</span>
          </span>
        </div>
      </div>

      {/* Highlights summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-pitwall-hairline/60 bg-pitwall-surface/70 p-3">
          <div className="font-mono text-[11px] text-pitwall-text-muted uppercase">Data Quality</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-pitwall-telemetry">
            Full Car Telemetry
          </div>
        </div>

        <div className="rounded-lg border border-pitwall-hairline/60 bg-pitwall-surface/70 p-3">
          <div className="font-mono text-[11px] text-pitwall-text-muted uppercase">Timing Grid</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-pitwall-text">
            20 Drivers Classified
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-lg border border-pitwall-hairline/60 bg-pitwall-surface/70 p-3">
          <div className="font-mono text-[11px] text-pitwall-text-muted uppercase">Simulation Engine</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-pitwall-drs">
            2 Hz Interpolation
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          asChild
          size="lg"
          className="flex-1 h-12 bg-pitwall-signal hover:bg-pitwall-signal/90 text-white font-semibold shadow-lg shadow-pitwall-signal/25 transition-all"
        >
          <Link href={replayHref} className="flex items-center justify-center gap-2">
            <Play className="h-4 w-4 fill-white" />
            <span>Launch Race Replay</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-12 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium"
        >
          <Link href="/replay/demo">
            Try Demo Telemetry
          </Link>
        </Button>
      </div>
    </div>
  );
}
