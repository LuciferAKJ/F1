import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { SelectedRace } from "@/store/replayStore";

/** Fetches the complete, unfiltered replay payload (every driver, every frame)
 * via the existing `/api/replay/{year}/{event}/{session}` endpoint — the same
 * one the WS/scrub hooks already rely on, just without a `driver` filter.
 * Cached indefinitely per race since a completed session's telemetry is static.
 */
export function useFullReplayData(race: SelectedRace | null) {
  return useQuery({
    queryKey: ["full-replay-data", race?.year, race?.event, race?.sessionType],
    queryFn: () => apiClient.getReplay(race!.year, race!.event, race!.sessionType),
    enabled: race !== null,
    staleTime: Infinity,
  });
}
