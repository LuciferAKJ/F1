import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export function useSeasonEvents(year: number | null) {
  return useQuery({
    queryKey: ["season-events", year],
    queryFn: () => apiClient.getSeasonEvents(year as number),
    enabled: year !== null,
    staleTime: 1000 * 60 * 60, // schedules rarely change
  });
}
