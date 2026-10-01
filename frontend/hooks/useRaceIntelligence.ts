import { useMemo } from "react";
import { useFullReplayData } from "@/hooks/useFullReplayData";
import { analyzeRace } from "@/lib/raceIntelligence";
import type { SelectedRace } from "@/store/replayStore";

/** Runs the (relatively heavy, O(frames × drivers)) race analysis exactly once
 * per fetched dataset via useMemo — never on a per-animation-frame basis. */
export function useRaceIntelligence(race: SelectedRace | null) {
  const { data, isLoading } = useFullReplayData(race);
  const intelligence = useMemo(() => (data ? analyzeRace(data.frames) : null), [data]);
  return { intelligence, isLoading };
}
