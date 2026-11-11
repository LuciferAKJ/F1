import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { SeasonEventDTO, SessionAvailabilityDTO } from "@/types/api";

export function useSeasonEvents(year: number | null, sessionType = "R") {
  return useQuery({
    queryKey: ["season-events", year, sessionType],
    queryFn: () => apiClient.getSeasonEvents(year as number, sessionType),
    enabled: year !== null,
    staleTime: 1000 * 60 * 60, // schedules rarely change
    retry: 1,
  });
}

export function useLatestAvailableSession() {
  return useQuery({
    queryKey: ["latest-available-session"],
    queryFn: () => apiClient.getLatestAvailableSession(),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
}

export function useVerifySessionAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, event, sessionType }: { year: number; event: string; sessionType: string }) =>
      apiClient.checkSessionAvailability(year, event, sessionType, true),
    onSuccess: (result: SessionAvailabilityDTO) => {
      // Update matching season-events cache entry in place
      queryClient.setQueryData<SeasonEventDTO[]>(
        ["season-events", result.year, result.sessionType],
        (prev) => {
          if (!prev) return prev;
          return prev.map((ev) => {
            if (ev.eventName.toLowerCase() !== (result.eventName ?? result.event).toLowerCase()) {
              return ev;
            }
            const nextVerified = ev.verifiedSessions ? [...ev.verifiedSessions] : [];
            if (result.verified && !nextVerified.includes(result.sessionType)) {
              nextVerified.push(result.sessionType);
            }
            return {
              ...ev,
              status: result.status,
              hasTelemetry: result.hasTelemetry,
              verified: result.verified,
              verifiedSessions: nextVerified,
              totalLaps: result.totalLaps ?? ev.totalLaps,
              driverCount: result.driverCount ?? ev.driverCount,
              circuit: result.circuit ?? ev.circuit,
              statusReason: result.statusReason,
            };
          });
        }
      );

      if (result.status === "available" && result.hasTelemetry) {
        queryClient.invalidateQueries({ queryKey: ["latest-available-session"] });
      }
    },
  });
}
