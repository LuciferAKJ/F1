import { useMemo } from "react";
import { useFullReplayData } from "@/hooks/useFullReplayData";
import { generateInsights } from "@/lib/raceInsights";
import type { RaceIntelligence } from "@/lib/raceIntelligence";
import type { SelectedRace } from "@/store/replayStore";

/**
 * `useFullReplayData` is backed by React Query, keyed on the race — calling
 * it again here (it's already called once in MainDashboard for
 * useRaceIntelligence) hits the cache rather than re-fetching. The insight
 * generation itself runs once via useMemo, gated on both the frame data and
 * the already-computed intelligence object (so it never re-runs just because
 * the replay clock ticked).
 */
export function useRaceInsights(race: SelectedRace | null, intelligence: RaceIntelligence | null) {
  const { data, isLoading } = useFullReplayData(race);

  const result = useMemo(() => {
    if (!data || !intelligence) return null;
    return generateInsights(data.frames, intelligence);
  }, [data, intelligence]);

  return {
    insights: result?.insights ?? [],
    summary: result?.summary ?? null,
    isLoading: isLoading || (data !== undefined && !intelligence),
  };
}
