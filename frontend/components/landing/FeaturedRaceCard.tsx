"use client";

import React from "react";
import Link from "next/link";
import {
  Play,
  Calendar,
  MapPin,
  Gauge,
  ShieldCheck,
  Sparkles,
  Clock,
  HelpCircle,
  AlertCircle,
  Loader2,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AvailabilityStatus, LatestAvailableSessionDTO } from "@/types/api";

interface FeaturedRaceCardProps {
  session: LatestAvailableSessionDTO | null | undefined;
  isLoading?: boolean;
  isError?: boolean;
  isVerifying?: boolean;
  onVerifySession?: () => void;
}

const SESSION_LABELS: Record<string, string> = {
  R: "Race (R)",
  Q: "Qualifying (Q)",
  S: "Sprint (S)",
  SS: "Sprint Qualifying (SS)",
  FP1: "Practice 1 (FP1)",
  FP2: "Practice 2 (FP2)",
  FP3: "Practice 3 (FP3)",
};

function renderStatusBadge(status: AvailabilityStatus | undefined, isDemo: boolean, isVerified: boolean) {
  if (isDemo) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 font-mono text-xs font-semibold text-amber-300 border border-amber-500/30">
        <FlaskConical className="h-3.5 w-3.5" />
        <span>SAMPLE DEMO DATA</span>
      </div>
    );
  }
  if (status === "available" && isVerified) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-pitwall-drs/10 px-3 py-1 font-mono text-xs font-semibold text-pitwall-drs border border-pitwall-drs/30">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>REPLAY VERIFIED</span>
      </div>
    );
  }
  if (status === "upcoming") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 font-mono text-xs font-semibold text-amber-400 border border-amber-500/30">
        <Clock className="h-3.5 w-3.5" />
        <span>UPCOMING SESSION</span>
      </div>
    );
  }
  if (status === "unverified") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-pitwall-telemetry/10 px-3 py-1 font-mono text-xs font-semibold text-pitwall-telemetry border border-pitwall-telemetry/30">
        <HelpCircle className="h-3.5 w-3.5" />
        <span>NOT VERIFIED</span>
      </div>
    );
  }
  if (status === "restricted") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-pitwall-hairline/40 px-3 py-1 font-mono text-xs font-semibold text-pitwall-text-muted border border-pitwall-hairline">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>RESTRICTED ARCHIVE</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 font-mono text-xs font-semibold text-rose-300 border border-rose-500/30">
      <AlertCircle className="h-3.5 w-3.5" />
      <span>{status === "unavailable" ? "UNAVAILABLE" : "AVAILABILITY UNKNOWN"}</span>
    </div>
  );
}

export function FeaturedRaceCard({
  session,
  isLoading,
  isError,
  isVerifying = false,
  onVerifySession,
}: FeaturedRaceCardProps) {
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

  // Proper fallback when backend failed or returned no verified session
  if (!session) {
    return (
      <div
        className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-pitwall-hairline bg-gradient-to-br from-pitwall-dock via-pitwall-dock/90 to-pitwall-surface p-6 md:p-8 shadow-2xl"
        data-testid="featured-race-fallback"
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pitwall-hairline/70 pb-4">
            <span className="flex items-center gap-1 rounded bg-amber-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-300 border border-amber-500/30">
              <FlaskConical className="h-3.5 w-3.5" />
              SAMPLE EXPERIENCE AVAILABLE
            </span>
            <span className="font-mono text-xs text-pitwall-text-muted">
              {isError ? "BACKEND UNAVAILABLE" : "NO VERIFIED REPLAY CACHED"}
            </span>
          </div>

          <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {isError ? "Unable to Reach Session Service" : "No Verified Grand Prix Replay Ready"}
          </h2>
          <p className="mt-2 text-sm text-pitwall-text-muted leading-relaxed">
            {isError
              ? "The backend availability service could not be reached. You can launch the offline Demo Grand Prix with sample telemetry while connectivity is restored."
              : "No historical race has been verified in the server cache yet. Explore the season archive below to verify a completed race, or try the offline Demo Grand Prix."}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            asChild
            size="lg"
            className="flex-1 h-12 bg-amber-500 hover:bg-amber-500/90 text-slate-950 font-semibold"
          >
            <Link href="/replay/demo" className="flex items-center justify-center gap-2">
              <Play className="h-4 w-4 fill-current" />
              <span>Watch Demo Grand Prix (Sample Telemetry)</span>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const isDemo = Boolean(session.isDemo || session.year === 0);
  const isPlayable =
    session.status === "available" && Boolean(session.hasTelemetry) && Boolean(session.verified);
  const canVerifyOnDemand = !isDemo && session.status === "unverified" && Boolean(onVerifySession);

  const replayHref = isDemo
    ? "/replay/demo"
    : `/replay/${session.year}/${encodeURIComponent(session.event)}/${session.sessionType || "R"}`;

  const bannerTitle = isDemo
    ? "SAMPLE DEMO TELEMETRY"
    : isPlayable
      ? "VERIFIED FEATURED SESSION"
      : "SELECTED SESSION";

  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-pitwall-hairline bg-gradient-to-br from-pitwall-dock via-pitwall-dock/90 to-pitwall-surface p-6 md:p-8 shadow-2xl"
      data-testid="featured-race-card"
    >
      <div>
        {/* Top Banner Tag */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pitwall-hairline/70 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded bg-pitwall-signal/15 px-2.5 py-0.5 font-mono text-xs font-bold text-pitwall-signal border border-pitwall-signal/30">
              <Sparkles className="h-3 w-3" />
              {bannerTitle}
            </span>
            {!isDemo && (
              <span className="font-mono text-xs text-pitwall-text-muted">
                {session.year} · {session.roundNumber > 0 ? `ROUND ${session.roundNumber}` : "TESTING"}
              </span>
            )}
          </div>

          {renderStatusBadge(session.status, isDemo, Boolean(session.verified))}
        </div>

        {/* Main Race Title & Details */}
        <div className="mt-5">
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            {session.eventName || session.event}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-pitwall-text-muted">
            {(session.location || session.country) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-pitwall-signal" />
                <span>
                  {session.location && session.location !== session.country
                    ? `${session.location}, ${session.country}`
                    : session.country}
                </span>
              </span>
            )}
            {session.eventDate && (
              <span className="flex items-center gap-1.5 font-mono">
                <Calendar className="h-4 w-4 text-pitwall-telemetry" />
                <span>{session.eventDate}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 font-mono">
              <Gauge className="h-4 w-4 text-amber-400" />
              <span>{SESSION_LABELS[session.sessionType] ?? session.sessionType}</span>
            </span>
          </div>
          {session.statusReason && (
            <p className="mt-3 text-xs text-pitwall-text-muted leading-relaxed">
              {session.statusReason}
            </p>
          )}
        </div>

        {/* Verified Metadata Metrics (never fabricate unverified metrics) */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-pitwall-hairline/60 bg-pitwall-surface/70 p-3">
            <div className="font-mono text-[11px] text-pitwall-text-muted uppercase">
              Telemetry Status
            </div>
            <div
              className={`mt-1 font-mono text-sm sm:text-base font-bold ${
                isDemo
                  ? "text-amber-300"
                  : isPlayable
                    ? "text-pitwall-drs"
                    : "text-pitwall-text-muted"
              }`}
            >
              {isDemo
                ? "Sample Telemetry"
                : isPlayable
                  ? "Verified & Ready"
                  : session.status === "unverified"
                    ? "Not Verified"
                    : "Unavailable"}
            </div>
          </div>

          <div className="rounded-lg border border-pitwall-hairline/60 bg-pitwall-surface/70 p-3">
            <div className="font-mono text-[11px] text-pitwall-text-muted uppercase">
              Classified Drivers
            </div>
            <div className="mt-1 font-mono text-sm sm:text-base font-bold text-pitwall-text">
              {isPlayable && session.driverCount ? `${session.driverCount} Drivers` : "Unavailable"}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-lg border border-pitwall-hairline/60 bg-pitwall-surface/70 p-3">
            <div className="font-mono text-[11px] text-pitwall-text-muted uppercase">
              Scheduled / Logged Laps
            </div>
            <div className="mt-1 font-mono text-sm sm:text-base font-bold text-pitwall-text">
              {isPlayable && session.totalLaps ? `${session.totalLaps} Laps` : "Unavailable"}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {isPlayable ? (
          <Button
            asChild
            size="lg"
            className="flex-1 h-12 bg-pitwall-signal hover:bg-pitwall-signal/90 text-white font-semibold shadow-lg shadow-pitwall-signal/25 transition-all"
          >
            <Link href={replayHref} className="flex items-center justify-center gap-2">
              <Play className="h-4 w-4 fill-white" />
              <span>{isDemo ? "Launch Sample Demo Replay" : "Launch Race Replay"}</span>
            </Link>
          </Button>
        ) : canVerifyOnDemand ? (
          <Button
            type="button"
            size="lg"
            disabled={isVerifying}
            onClick={onVerifySession}
            className="flex-1 h-12 bg-pitwall-telemetry/20 hover:bg-pitwall-telemetry/30 text-pitwall-telemetry border border-pitwall-telemetry/40 font-semibold"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying Telemetry…</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Check availability</span>
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            disabled
            className="flex-1 h-12 bg-pitwall-surface text-pitwall-text-muted cursor-not-allowed"
          >
            <span>Replay Unavailable</span>
          </Button>
        )}

        {!isDemo && (
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium"
          >
            <Link href="/replay/demo">Try Sample Demo</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
