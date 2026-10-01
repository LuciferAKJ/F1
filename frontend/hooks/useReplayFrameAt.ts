import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";

/** Fetches the nearest frame for the current scrub position whenever paused. Playback
 * itself is driven by the WebSocket hook; this only keeps the display in sync on manual seeks. */
export function useReplayFrameAt(race: SelectedRace | null, timestamp: number, enabled: boolean) {
  const setCurrentFrame = useReplayStore((s) => s.setCurrentFrame);

  const query = useQuery({
    queryKey: ["replay-frame", race?.year, race?.event, race?.sessionType, timestamp],
    queryFn: () => apiClient.getReplayFrameAt(race!.year, race!.event, race!.sessionType, timestamp),
    enabled: enabled && race !== null,
  });

  useEffect(() => {
    if (query.data?.frame) setCurrentFrame(query.data.frame);
  }, [query.data, setCurrentFrame]);

  return query;
}
