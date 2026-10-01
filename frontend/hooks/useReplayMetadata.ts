import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";

export function useReplayMetadata(race: SelectedRace | null) {
  const setMetadata = useReplayStore((s) => s.setMetadata);

  const query = useQuery({
    queryKey: ["replay-metadata", race?.year, race?.event, race?.sessionType],
    queryFn: () => apiClient.getReplayMetadata(race!.year, race!.event, race!.sessionType),
    enabled: race !== null,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    setMetadata(query.data ?? null);
  }, [query.data, setMetadata]);

  return query;
}
