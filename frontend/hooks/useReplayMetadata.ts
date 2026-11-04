import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";

export function useReplayMetadata(race: SelectedRace | null) {
  const setMetadata = useReplayStore((s) => s.setMetadata);
  const setMetadataError = useReplayStore((s) => s.setMetadataError);
  const setIsMetadataLoading = useReplayStore((s) => s.setIsMetadataLoading);

  const query = useQuery({
    queryKey: ["replay-metadata", race?.year, race?.event, race?.sessionType],
    queryFn: () => apiClient.getReplayMetadata(race!.year, race!.event, race!.sessionType),
    enabled: race !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
  });

  useEffect(() => {
    setIsMetadataLoading(query.isLoading);
    if (query.isError) {
      setMetadata(null);
      setMetadataError(query.error instanceof Error ? query.error.message : String(query.error));
    } else if (query.data) {
      setMetadata(query.data);
      setMetadataError(null);
    } else if (query.isLoading) {
      setMetadata(null);
      setMetadataError(null);
    }
  }, [
    query.data,
    query.isError,
    query.isLoading,
    query.error,
    setMetadata,
    setMetadataError,
    setIsMetadataLoading,
  ]);

  return query;
}
