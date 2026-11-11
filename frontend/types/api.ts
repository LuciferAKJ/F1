import type { CircuitData, DriverMeta } from "@/types/replay";
import type { RawReplayFrame } from "@/lib/replayAdapter";

export type AvailabilityStatus =
  | "available"
  | "upcoming"
  | "unverified"
  | "unavailable"
  | "restricted"
  | "unknown";

export interface SeasonEventDTO {
  roundNumber: number;
  eventName: string;
  country: string;
  location: string;
  eventDate: string;
  sessionType?: string;
  status?: AvailabilityStatus;
  hasTelemetry?: boolean;
  eventExists?: boolean;
  hasOccurred?: boolean;
  sessionExists?: boolean;
  sessionSupported?: boolean;
  verified?: boolean;
  verifiedSessions?: string[];
  totalLaps?: number | null;
  driverCount?: number | null;
  circuit?: CircuitDataDTO | null;
  statusReason?: string | null;
}

export interface SessionAvailabilityDTO {
  year: number;
  event: string;
  sessionType: string;
  roundNumber?: number | null;
  eventName?: string | null;
  country?: string | null;
  location?: string | null;
  eventDate?: string | null;
  status: AvailabilityStatus;
  hasTelemetry: boolean;
  eventExists: boolean;
  hasOccurred: boolean;
  sessionExists: boolean;
  sessionSupported: boolean;
  verified: boolean;
  isDemo?: boolean;
  totalLaps?: number | null;
  driverCount?: number | null;
  circuit?: CircuitDataDTO | null;
  statusReason?: string | null;
}

export interface LatestAvailableSessionDTO {
  year: number;
  event: string;
  sessionType: string;
  roundNumber: number;
  eventName: string;
  country: string;
  location: string;
  eventDate: string;
  isDemo?: boolean;
  hasTelemetry?: boolean;
  verified?: boolean;
  hasVerifiedRealSession?: boolean;
  status?: AvailabilityStatus;
  totalLaps?: number | null;
  driverCount?: number | null;
  circuit?: CircuitDataDTO | null;
  statusReason?: string | null;
}

export interface SessionInfoDTO {
  year: number;
  event: string;
  sessionType: string;
  sessionName: string;
  totalLaps: number | null;
  isDemo?: boolean;
}

export interface DriverMetaDTO {
  abbreviation: string;
  teamName: string;
  teamColor: string;
  driverNumber: string;
}

export interface CircuitDataDTO {
  x: number[];
  y: number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ReplayMetadataDTO {
  info: SessionInfoDTO;
  drivers: DriverMetaDTO[];
  circuit: CircuitDataDTO;
  totalLaps: number | null;
  duration: number;
  frameInterval: number;
  frameCount: number;
  isDemo?: boolean;
}

export interface ReplayResponseDTO {
  info: SessionInfoDTO;
  drivers: DriverMetaDTO[];
  circuit: CircuitDataDTO;
  frames: RawReplayFrame[];
  raceDuration: number;
  isDemo?: boolean;
}

export interface ReplayFrameResponseDTO {
  frame: RawReplayFrame | null;
}

export function toCircuitData(dto: CircuitDataDTO): CircuitData {
  return { x: dto.x, y: dto.y, minX: dto.minX, maxX: dto.maxX, minY: dto.minY, maxY: dto.maxY };
}

export function toDriverMeta(dto: DriverMetaDTO): DriverMeta {
  return {
    abbreviation: dto.abbreviation,
    teamName: dto.teamName,
    teamColor: dto.teamColor,
    driverNumber: dto.driverNumber,
  };
}
