"use client";

import React from "react";
import Link from "next/link";
import {
  Play,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  HelpCircle,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import type { SeasonEventDTO } from "@/types/api";
import { getStatusDisplay, isSessionPlayable } from "./availabilityUtils";

interface RecentRoundsGridProps {
  year: number;
  sessionType?: string;
  events: SeasonEventDTO[] | undefined;
  isLoading?: boolean;
  verifyingEvent?: string | null;
  onSelectEvent?: (event: SeasonEventDTO) => void;
  onVerifyEvent?: (eventName: string, sessionType: string) => void;
}

export function RecentRoundsGrid({
  year,
  sessionType = "R",
  events,
  isLoading,
  verifyingEvent,
  onSelectEvent,
  onVerifyEvent,
}: RecentRoundsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="recent-rounds-skeleton">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-pitwall-hairline bg-pitwall-dock/70 p-4">
            <div className="h-3 w-16 rounded bg-pitwall-surface" />
            <div className="mt-3 h-5 w-3/4 rounded bg-pitwall-surface" />
            <div className="mt-2 h-3 w-1/2 rounded bg-pitwall-surface" />
            <div className="mt-4 h-8 rounded bg-pitwall-surface" />
          </div>
        ))}
      </div>
    );
  }

  // Prefer occurred championship rounds sorted most-recent first; fallback to highest rounds if all upcoming
  const validEvents = (events ?? [])
    .filter((e) => e.roundNumber > 0)
    .slice()
    .sort((a, b) => {
      const aVerified = isSessionPlayable(a) ? 1 : 0;
      const bVerified = isSessionPlayable(b) ? 1 : 0;
      if (bVerified !== aVerified) return bVerified - aVerified;
      const aOccurred = a.hasOccurred !== false && a.status !== "upcoming" ? 1 : 0;
      const bOccurred = b.hasOccurred !== false && b.status !== "upcoming" ? 1 : 0;
      if (bOccurred !== aOccurred) return bOccurred - aOccurred;
      return b.roundNumber - a.roundNumber;
    })
    .slice(0, 4);

  if (validEvents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="recent-rounds-grid">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-bold tracking-tight text-white">
            Recent Grand Prix Rounds
          </h3>
          <p className="text-xs text-pitwall-text-muted">
            Completed and scheduled rounds from the {year} FIA Formula 1 World Championship
          </p>
        </div>
        <span className="font-mono text-xs text-pitwall-telemetry">
          {validEvents.length} ROUNDS
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {validEvents.map((ev) => {
          const playable = isSessionPlayable(ev);
          const { label, status } = getStatusDisplay(ev);
          const activeSession = ev.sessionType ?? sessionType;
          const isCheckingThis = verifyingEvent === ev.eventName;
          const replayUrl = `/replay/${year}/${encodeURIComponent(ev.eventName)}/${activeSession}`;

          return (
            <div
              key={ev.eventName}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-pitwall-hairline/80 bg-pitwall-dock/80 p-4 transition-all hover:border-pitwall-telemetry/50 hover:bg-pitwall-surface/80 hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-pitwall-surface px-2 py-0.5 font-mono text-[10px] font-bold text-pitwall-text-muted border border-pitwall-hairline">
                    ROUND {ev.roundNumber}
                  </span>

                  {status === "available" && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-pitwall-drs">
                      <CheckCircle2 className="h-3 w-3" />
                      {label}
                    </span>
                  )}
                  {status === "upcoming" && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-amber-400">
                      <Clock className="h-3 w-3" />
                      {label}
                    </span>
                  )}
                  {status === "unverified" && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-pitwall-telemetry">
                      <HelpCircle className="h-3 w-3" />
                      {label}
                    </span>
                  )}
                  {(status === "unavailable" || status === "restricted" || status === "unknown") && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-pitwall-text-muted">
                      <AlertCircle className="h-3 w-3" />
                      {label}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onSelectEvent?.(ev)}
                  className="mt-2.5 text-left font-display text-lg font-bold text-white group-hover:text-pitwall-telemetry transition-colors line-clamp-1"
                >
                  {ev.eventName}
                </button>

                <div className="mt-1 flex items-center gap-1.5 text-xs text-pitwall-text-muted">
                  <MapPin className="h-3 w-3 text-pitwall-signal shrink-0" />
                  <span className="truncate">{ev.country}</span>
                </div>

                {ev.eventDate && (
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-pitwall-text-muted/80">
                    <Calendar className="h-3 w-3 text-pitwall-telemetry/70 shrink-0" />
                    <span>{ev.eventDate}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-pitwall-hairline/50">
                {playable ? (
                  <Link
                    href={replayUrl}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-pitwall-surface py-2 font-mono text-xs font-semibold text-pitwall-text transition-all hover:bg-pitwall-signal hover:text-white"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>Watch Replay</span>
                  </Link>
                ) : status === "unverified" && onVerifyEvent ? (
                  <button
                    type="button"
                    disabled={isCheckingThis}
                    onClick={() => onVerifyEvent(ev.eventName, activeSession)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-pitwall-telemetry/40 bg-pitwall-telemetry/10 py-2 font-mono text-xs font-semibold text-pitwall-telemetry transition-all hover:bg-pitwall-telemetry/20 disabled:opacity-60"
                  >
                    {isCheckingThis ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Checking…</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3 w-3" />
                        <span>Check availability</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-pitwall-surface/40 py-2 font-mono text-xs text-pitwall-text-muted opacity-70"
                  >
                    <span>{status === "upcoming" ? "Scheduled" : label}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
