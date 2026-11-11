import type {
  SeasonEventDTO,
  LatestAvailableSessionDTO,
  SessionAvailabilityDTO,
  ReplayMetadataDTO,
  ReplayResponseDTO,
  ReplayFrameResponseDTO,
} from "@/types/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000";

async function getJson<T>(path: string, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`API ${res.status} ${path}: ${detail}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export const apiClient = {
  getLatestAvailableSession: () => getJson<LatestAvailableSessionDTO>("/api/sessions/latest-available"),

  getSeasonEvents: (year: number, sessionType = "R") => {
    const qs = sessionType && sessionType !== "R" ? `?session_type=${encodeURIComponent(sessionType)}` : "";
    return getJson<SeasonEventDTO[]>(`/api/sessions/${year}/events${qs}`);
  },

  checkSessionAvailability: (year: number, event: string, sessionType: string, verify = false) =>
    getJson<SessionAvailabilityDTO>(
      `/api/sessions/${year}/${encodeURIComponent(event)}/${encodeURIComponent(sessionType)}/availability${
        verify ? "?verify=true" : ""
      }`,
      verify ? 90_000 : 15_000
    ),

  getReplayMetadata: (year: number, event: string, sessionType: string) => {
    if (year === 0 || event.toLowerCase().includes("demo")) {
      return getJson<ReplayMetadataDTO>("/api/replay/demo/metadata");
    }
    return getJson<ReplayMetadataDTO>(`/api/replay/${year}/${encodeURIComponent(event)}/${sessionType}/metadata`);
  },

  getReplay: (
    year: number,
    event: string,
    sessionType: string,
    params?: { startTime?: number; endTime?: number; lap?: number; driver?: string }
  ) => {
    if (year === 0 || event.toLowerCase().includes("demo")) {
      return getJson<ReplayResponseDTO>("/api/replay/demo");
    }
    const qs = new URLSearchParams();
    if (params?.startTime !== undefined) qs.set("start_time", String(params.startTime));
    if (params?.endTime !== undefined) qs.set("end_time", String(params.endTime));
    if (params?.lap !== undefined) qs.set("lap", String(params.lap));
    if (params?.driver) qs.set("driver", params.driver);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return getJson<ReplayResponseDTO>(`/api/replay/${year}/${encodeURIComponent(event)}/${sessionType}${suffix}`);
  },

  getReplayFrameAt: (year: number, event: string, sessionType: string, timestamp: number) => {
    if (year === 0 || event.toLowerCase().includes("demo")) {
      return getJson<ReplayFrameResponseDTO>(`/api/replay/demo/frame/${timestamp}`);
    }
    return getJson<ReplayFrameResponseDTO>(
      `/api/replay/${year}/${encodeURIComponent(event)}/${sessionType}/frame/${timestamp}`
    );
  },
};

export function wsReplayUrl(year: number, event: string, sessionType: string): string {
  const wsBase =
    process.env.NEXT_PUBLIC_WS_URL ??
    API_BASE.replace(/^http(s?):/, "ws$1:");
  if (year === 0 || event.toLowerCase().includes("demo")) {
    return `${wsBase}/ws/replay/0/Demo%20Grand%20Prix/R`;
  }
  return `${wsBase}/ws/replay/${year}/${encodeURIComponent(event)}/${sessionType}`;
}
