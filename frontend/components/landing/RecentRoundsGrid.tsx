"use client";

import React from "react";
import Link from "next/link";
import { Play, Calendar, MapPin, CheckCircle2, Clock } from "lucide-react";
import type { SeasonEventDTO } from "@/types/api";

interface RecentRoundsGridProps {
  year: number;
  events: SeasonEventDTO[] | undefined;
  isLoading?: boolean;
  onSelectEvent?: (eventName: string) => void;
}

export function RecentRoundsGrid({
  year,
  events,
  isLoading,
  onSelectEvent,
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

  // Filter completed or championship events with roundNumber > 0
  const validEvents = (events ?? [])
    .filter((e) => e.roundNumber > 0)
    .slice()
    .sort((a, b) => b.roundNumber - a.roundNumber) // latest rounds first
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
            Highlights from the {year} FIA Formula 1 World Championship
          </p>
        </div>
        <span className="font-mono text-xs text-pitwall-telemetry">
          {validEvents.length} ROUNDS
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {validEvents.map((ev) => {
          const isUpcoming = ev.status === "upcoming";
          const isAvailable = ev.status === "available" || (!ev.status && !isUpcoming);
          const replayUrl = `/replay/${year}/${encodeURIComponent(ev.eventName)}/R`;

          return (
            <div
              key={ev.eventName}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-pitwall-hairline/80 bg-pitwall-dock/80 p-4 transition-all hover:border-pitwall-telemetry/50 hover:bg-pitwall-surface/80 hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-pitwall-surface px-2 py-0.5 font-mono text-[10px] font-bold text-pitwall-text-muted border border-pitwall-hairline">
                    ROUND {ev.roundNumber}
                  </span>

                  {isAvailable ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-pitwall-drs">
                      <CheckCircle2 className="h-3 w-3" />
                      Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-amber-400">
                      <Clock className="h-3 w-3" />
                      Upcoming
                    </span>
                  )}
                </div>

                <h4 className="mt-2.5 font-display text-lg font-bold text-white group-hover:text-pitwall-telemetry transition-colors line-clamp-1">
                  {ev.eventName}
                </h4>

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
                {isAvailable ? (
                  <Link
                    href={replayUrl}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-pitwall-surface py-2 font-mono text-xs font-semibold text-pitwall-text transition-all hover:bg-pitwall-signal hover:text-white"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>Watch Replay</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-pitwall-surface/40 py-2 font-mono text-xs text-pitwall-text-muted opacity-70"
                  >
                    <span>Scheduled</span>
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
