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
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    setMetadata(query.data ?? null);
  }, [query.data, setMetadata]);

  return query;
}
