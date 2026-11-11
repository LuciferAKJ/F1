"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Loader2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { SeasonEventDTO } from "@/types/api";
import { getStatusDisplay, isSessionPlayable } from "./availabilityUtils";

const CURRENT_YEAR = new Date().getFullYear();
const SEASONS = Array.from({ length: CURRENT_YEAR - 2017 }, (_, i) => CURRENT_YEAR - i);

const SESSION_TYPES = [
  { value: "R", label: "Race (R)" },
  { value: "Q", label: "Qualifying (Q)" },
  { value: "S", label: "Sprint (S)" },
];

interface SeasonArchiveSelectorProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  sessionType?: string;
  onSessionTypeChange?: (sessionType: string) => void;
  events: SeasonEventDTO[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  verifyingEvent?: string | null;
  onSelectEvent?: (event: SeasonEventDTO) => void;
  onVerifyEvent?: (eventName: string, sessionType: string) => void;
  selectedEventName?: string;
}

export function SeasonArchiveSelector({
  selectedYear,
  onYearChange,
  sessionType,
  onSessionTypeChange,
  events,
  isLoading,
  isError,
  verifyingEvent,
  onSelectEvent,
  onVerifyEvent,
  selectedEventName,
}: SeasonArchiveSelectorProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [localSessionType, setLocalSessionType] = useState("R");

  const activeSessionType = sessionType ?? localSessionType;

  const handleSessionChange = (nextSession: string) => {
    setLocalSessionType(nextSession);
    onSessionTypeChange?.(nextSession);
  };

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    const q = searchQuery.trim().toLowerCase();
    const sorted = events.slice().sort((a, b) => a.roundNumber - b.roundNumber);
    if (!q) return sorted;
    return sorted.filter(
      (e) =>
        e.eventName.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        `round ${e.roundNumber}`.includes(q) ||
        `rd ${e.roundNumber}`.includes(q)
    );
  }, [events, searchQuery]);

  const handleLaunch = (ev: SeasonEventDTO) => {
    if (!isSessionPlayable(ev)) return;
    const targetSession = ev.sessionType || activeSessionType;
    router.push(`/replay/${selectedYear}/${encodeURIComponent(ev.eventName)}/${targetSession}`);
  };

  return (
    <div
      id="season-archive"
      className="rounded-xl border border-pitwall-hairline bg-pitwall-dock/85 p-6 shadow-2xl backdrop-blur-md"
      data-testid="season-archive-selector"
    >
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 border-b border-pitwall-hairline/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold tracking-tight text-white">
            Season Archive &amp; Discovery
          </h3>
          <p className="mt-1 text-xs text-pitwall-text-muted">
            Inspect verified replays or check FastF1 session availability from 2018 to {CURRENT_YEAR}
          </p>
        </div>

        {/* Season and Session Type Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-pitwall-text-muted">Season:</span>
            <Select
              value={String(selectedYear)}
              onValueChange={(val) => onYearChange(Number(val))}
            >
              <SelectTrigger
                aria-label="Select season year"
                className="w-28 h-9 border-pitwall-hairline bg-pitwall-surface font-mono text-xs text-pitwall-text"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-pitwall-hairline bg-pitwall-dock text-pitwall-text">
                {SEASONS.map((y) => (
                  <SelectItem key={y} value={String(y)} className="font-mono text-xs">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-pitwall-text-muted">Session:</span>
            <Select value={activeSessionType} onValueChange={handleSessionChange}>
              <SelectTrigger
                aria-label="Select session type"
                className="w-36 h-9 border-pitwall-hairline bg-pitwall-surface font-mono text-xs text-pitwall-text"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-pitwall-hairline bg-pitwall-dock text-pitwall-text">
                {SESSION_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="font-mono text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Search Input Filter */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pitwall-text-muted" />
          <Input
            type="text"
            placeholder="Search by Grand Prix, country, or circuit (e.g. Monaco, Silverstone, Spa)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9 pr-9 border-pitwall-hairline bg-pitwall-surface text-sm text-pitwall-text placeholder:text-pitwall-text-muted/60"
            aria-label="Filter Grand Prix events"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-pitwall-text-muted hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-pitwall-text-muted">
          <Filter className="h-3.5 w-3.5 text-pitwall-telemetry" />
          <span>
            Showing <strong className="text-white">{filteredEvents.length}</strong> of {events?.length ?? 0} events
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {isError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-pitwall-signal/40 bg-pitwall-signal/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-pitwall-signal" />
          <span>
            Unable to load the race schedule for season {selectedYear}. Please check your connection or switch seasons.
          </span>
        </div>
      )}

      {/* Events List / Grid */}
      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-3" data-testid="archive-loading-skeleton">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex animate-pulse items-center justify-between rounded-lg border border-pitwall-hairline bg-pitwall-surface/50 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-8 w-12 rounded bg-pitwall-surface" />
                  <div className="space-y-2">
                    <div className="h-4 w-48 rounded bg-pitwall-surface" />
                    <div className="h-3 w-32 rounded bg-pitwall-surface" />
                  </div>
                </div>
                <div className="h-8 w-24 rounded bg-pitwall-surface" />
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-pitwall-hairline p-8 text-center" data-testid="archive-empty-state">
            <Search className="mx-auto h-8 w-8 text-pitwall-text-muted/50" />
            <h4 className="mt-2 font-display text-base font-semibold text-white">
              No Grand Prix Found
            </h4>
            <p className="mt-1 text-xs text-pitwall-text-muted">
              {searchQuery
                ? `No race matching "${searchQuery}" in the ${selectedYear} calendar.`
                : `No events recorded for season ${selectedYear}.`}
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-4 border-pitwall-hairline text-xs"
              >
                Clear Search Query
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-pitwall-hairline/50 overflow-hidden rounded-lg border border-pitwall-hairline/80 bg-pitwall-surface/40">
            {filteredEvents.map((ev) => {
              const playable = isSessionPlayable(ev);
              const display = getStatusDisplay(ev);
              const isSelected = selectedEventName === ev.eventName;
              const evSessionType = ev.sessionType || activeSessionType;
              const isVerifying = verifyingEvent === ev.eventName;

              return (
                <div
                  key={`${ev.roundNumber}-${ev.eventName}`}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors hover:bg-pitwall-surface/80 ${
                    isSelected ? "bg-pitwall-surface border-l-2 border-l-pitwall-telemetry" : ""
                  }`}
                  data-testid={`event-row-${ev.roundNumber}`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded bg-pitwall-dock font-mono text-xs font-bold text-pitwall-text-muted border border-pitwall-hairline">
                      {ev.roundNumber > 0 ? `R${ev.roundNumber}` : "TEST"}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectEvent?.(ev)}
                          className="font-display text-base font-bold text-white hover:text-pitwall-telemetry transition-colors text-left"
                        >
                          {ev.eventName}
                        </button>
                        {isSelected && (
                          <span className="rounded bg-pitwall-telemetry/15 px-1.5 py-0.5 font-mono text-[10px] text-pitwall-telemetry border border-pitwall-telemetry/30">
                            Active Preview
                          </span>
                        )}
                        {ev.verifiedSessions && ev.verifiedSessions.length > 0 && (
                          <span className="rounded bg-pitwall-dock px-1.5 py-0.5 font-mono text-[10px] text-pitwall-text-muted border border-pitwall-hairline">
                            Verified: {ev.verifiedSessions.join(", ")}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-pitwall-text-muted">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-pitwall-signal" />
                          <span>{ev.location ? `${ev.location}, ${ev.country}` : ev.country}</span>
                        </span>
                        {ev.eventDate && (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Calendar className="h-3 w-3 text-pitwall-telemetry/70" />
                            <span>{ev.eventDate}</span>
                          </span>
                        )}
                        {ev.statusReason && !playable && (
                          <span className="text-[11px] text-pitwall-text-muted/75">
                            {ev.statusReason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-pitwall-hairline/40 shrink-0">
                    {/* Truthful Status Badge */}
                    {display.status === "available" && (
                      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-pitwall-drs/10 px-2.5 py-1 font-mono text-[11px] font-medium text-pitwall-drs border border-pitwall-drs/30">
                        <CheckCircle2 className="h-3 w-3" />
                        {display.label}
                      </span>
                    )}

                    {display.status === "upcoming" && (
                      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] font-medium text-amber-400 border border-amber-500/30">
                        <Clock className="h-3 w-3" />
                        {display.label}
                      </span>
                    )}

                    {display.status === "unverified" && (
                      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-pitwall-surface px-2.5 py-1 font-mono text-[11px] font-medium text-pitwall-text-muted border border-pitwall-hairline">
                        <HelpCircle className="h-3 w-3" />
                        {display.label}
                      </span>
                    )}

                    {(display.status === "restricted" || display.status === "unavailable" || display.status === "unknown") && (
                      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-pitwall-hairline/40 px-2.5 py-1 font-mono text-[11px] font-medium text-pitwall-text-muted border border-pitwall-hairline">
                        <AlertCircle className="h-3 w-3" />
                        {display.label}
                      </span>
                    )}

                    {/* Truthful Action Button */}
                    {playable ? (
                      <Button
                        size="sm"
                        onClick={() => handleLaunch(ev)}
                        className="h-8 shrink-0 whitespace-nowrap gap-1.5 bg-pitwall-signal hover:bg-pitwall-signal/90 text-white font-mono text-xs px-3 shadow-sm"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>Launch</span>
                      </Button>
                    ) : display.status === "unverified" && onVerifyEvent ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isVerifying}
                        onClick={() => onVerifyEvent(ev.eventName, evSessionType)}
                        className="h-8 shrink-0 whitespace-nowrap gap-1.5 border-pitwall-hairline bg-pitwall-surface hover:bg-pitwall-dock font-mono text-xs text-pitwall-text px-3"
                      >
                        {isVerifying ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3 w-3 text-pitwall-telemetry" />
                        )}
                        <span>{isVerifying ? "Checking..." : "Check availability"}</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled
                        className="h-8 font-mono text-xs text-pitwall-text-muted/60 opacity-60 cursor-not-allowed"
                      >
                        <span>{display.status === "upcoming" ? "Upcoming" : "Unavailable"}</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
