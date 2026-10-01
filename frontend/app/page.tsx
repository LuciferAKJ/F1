"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { useSeasonEvents } from "@/hooks/useSeasonEvents";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2017 }, (_, i) => CURRENT_YEAR - i);
const SESSION_TYPES = [
  { value: "R", label: "Race" },
  { value: "Q", label: "Qualifying" },
  { value: "S", label: "Sprint" },
  { value: "FP1", label: "Practice 1" },
  { value: "FP2", label: "Practice 2" },
  { value: "FP3", label: "Practice 3" },
];

export default function RaceSelectorPage() {
  const router = useRouter();
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [event, setEvent] = useState<string>("");
  const [sessionType, setSessionType] = useState<string>("R");

  const { data: events, isLoading, isError } = useSeasonEvents(year);
  const sortedEvents = useMemo(
    () => (events ?? []).slice().sort((a, b) => a.roundNumber - b.roundNumber),
    [events]
  );

  const canGo = year && event && sessionType;

  const handleGo = () => {
    if (!canGo) return;
    router.push(`/replay/${year}/${encodeURIComponent(event)}/${sessionType}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in rounded-xl border border-border bg-panel p-8">
        <div className="mb-6 flex items-center gap-2">
          <Flag className="h-6 w-6 text-accent" aria-hidden="true" />
          <h1 className="text-xl font-bold">F1 Race Replay</h1>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted" id="season-label">Season</label>
            <Select
              value={String(year)}
              onValueChange={(v) => {
                setYear(Number(v));
                setEvent("");
              }}
            >
              <SelectTrigger aria-labelledby="season-label"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted" id="event-label">Grand Prix</label>
            <Select value={event} onValueChange={setEvent} disabled={isLoading || isError}>
              <SelectTrigger aria-labelledby="event-label" aria-busy={isLoading}>
                <SelectValue placeholder={isLoading ? "Loading events…" : "Select a Grand Prix"} />
              </SelectTrigger>
              <SelectContent>
                {sortedEvents.map((e) => (
                  <SelectItem key={e.eventName} value={e.eventName}>
                    Rd {e.roundNumber} — {e.eventName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isError && (
              <p className="mt-1 text-xs text-accent" role="alert">
                Failed to load events for {year}.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted" id="session-label">Session</label>
            <Select value={sessionType} onValueChange={setSessionType}>
              <SelectTrigger aria-labelledby="session-label"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" disabled={!canGo} onClick={handleGo}>
            Load Replay
          </Button>
        </div>
      </div>
    </main>
  );
}
