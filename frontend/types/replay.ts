// Core data contracts shared between the PixiJS engine, hooks, and API layer.

export interface CircuitData {
  x: number[];
  y: number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface DriverMeta {
  abbreviation: string;
  teamName: string;
  teamColor: string; // hex, e.g. "#DA291C"
  driverNumber: string;
}

export interface DriverFrame {
  abbr: string;
  x: number;
  y: number;
  speed: number;
  gear: number;
  throttle: number;
  brake: boolean;
  rpm: number;
  drs: number;
  heading: number;
  lap: number;
  sector: number;
  compound: string;
  pit: boolean;
}

export interface WeatherFrame {
  airTemp: number;
  trackTemp: number;
  humidity: number;
  windSpeed: number;
  rainfall: boolean;
}

export interface ReplayFrame {
  raceTimeSeconds: number;
  lap: number;
  drivers: Record<string, DriverFrame>;
  weather: WeatherFrame;
}

export type CameraMode = "free" | "follow";
