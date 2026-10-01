import type {
  SeasonEventDTO, ReplayMetadataDTO, ReplayResponseDTO, ReplayFrameResponseDTO,
} from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${path}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  getSeasonEvents: (year: number) => getJson<SeasonEventDTO[]>(`/api/sessions/${year}/events`),

  getReplayMetadata: (year: number, event: string, sessionType: string) =>
    getJson<ReplayMetadataDTO>(`/api/replay/${year}/${encodeURIComponent(event)}/${sessionType}/metadata`),

  getReplay: (
    year: number,
    event: string,
    sessionType: string,
    params?: { startTime?: number; endTime?: number; lap?: number; driver?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.startTime !== undefined) qs.set("start_time", String(params.startTime));
    if (params?.endTime !== undefined) qs.set("end_time", String(params.endTime));
    if (params?.lap !== undefined) qs.set("lap", String(params.lap));
    if (params?.driver) qs.set("driver", params.driver);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return getJson<ReplayResponseDTO>(`/api/replay/${year}/${encodeURIComponent(event)}/${sessionType}${suffix}`);
  },

  getReplayFrameAt: (year: number, event: string, sessionType: string, timestamp: number) =>
    getJson<ReplayFrameResponseDTO>(
      `/api/replay/${year}/${encodeURIComponent(event)}/${sessionType}/frame/${timestamp}`
    ),
};

export function wsReplayUrl(year: number, event: string, sessionType: string): string {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return `${wsBase}/ws/replay/${year}/${encodeURIComponent(event)}/${sessionType}`;
}
