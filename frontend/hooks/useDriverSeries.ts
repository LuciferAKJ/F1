import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { SelectedRace } from "@/store/replayStore";

export interface TelemetryPoint {
  t: number;
  speed: number;
  throttle: number;
  brake: number; // 0 or 100 — derived from the pipeline's boolean brake flag, not a real pressure %
  rpm: number;
  gear: number;
}

/**
 * Fetches one driver's full-session telemetry via the existing filtered
 * `/api/replay/{year}/{event}/{session}?driver=ABBR` endpoint (no backend
 * changes) and reshapes it into a flat, chart-ready time series. Cached by
 * React Query per driver so re-selecting a previously-viewed driver, or
 * toggling comparison mode, doesn't refetch or recompute.
 */
export function useDriverSeries(race: SelectedRace | null, driverAbbr: string | null) {
  const query = useQuery({
    queryKey: ["driver-series", race?.year, race?.event, race?.sessionType, driverAbbr],
    queryFn: () => apiClient.getReplay(race!.year, race!.event, race!.sessionType, { driver: driverAbbr! }),
    enabled: race !== null && driverAbbr !== null,
    staleTime: Infinity, // a completed session's telemetry never changes
  });

  const series = useMemo<TelemetryPoint[]>(() => {
    if (!query.data) return [];
    const points: TelemetryPoint[] = [];
    for (const frame of query.data.frames) {
      const d = frame.drivers[0];
      if (!d) continue;
      points.push({
        t: frame.timestamp, speed: d.speed, throttle: d.throttle,
        brake: d.brake ? 100 : 0, rpm: d.rpm, gear: d.gear,
      });
    }
    return points;
  }, [query.data]);

  return { series, isLoading: query.isLoading, isError: query.isError };
}
