import type { CircuitData, DriverMeta } from "@/types/replay";
import type { RawReplayFrame } from "@/lib/replayAdapter";

export interface SeasonEventDTO {
  roundNumber: number;
  eventName: string;
  country: string;
  location: string;
  eventDate: string;
}

export interface SessionInfoDTO {
  year: number;
  event: string;
  sessionType: string;
  sessionName: string;
  totalLaps: number | null;
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
}

export interface ReplayResponseDTO {
  info: SessionInfoDTO;
  drivers: DriverMetaDTO[];
  circuit: CircuitDataDTO;
  frames: RawReplayFrame[];
  raceDuration: number;
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
