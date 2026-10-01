import type { DriverFrame, ReplayFrame, WeatherFrame } from "@/types/replay";

// Shape returned by both REST (/api/replay/...) and the /ws/replay/... WebSocket "frame" messages.
export interface RawDriverFrame {
  driverId: string;
  x: number;
  y: number;
  speed: number;
  gear: number;
  throttle: number;
  brake: boolean;
  rpm: number;
  drs: number;
  tyre: string;
  lap: number;
  sector: number;
  position: number;
}

export interface RawReplayFrame {
  timestamp: number;
  lap: number;
  drivers: RawDriverFrame[];
}

const DEFAULT_WEATHER: WeatherFrame = {
  airTemp: 0, trackTemp: 0, humidity: 0, windSpeed: 0, rainfall: false,
};

/** Convert the backend's array-of-drivers frame shape into the engine's abbr-keyed record shape. */
export function toReplayFrame(raw: RawReplayFrame, weather: WeatherFrame = DEFAULT_WEATHER): ReplayFrame {
  const drivers: Record<string, DriverFrame> = {};
  for (const d of raw.drivers) {
    drivers[d.driverId] = {
      abbr: d.driverId,
      x: d.x,
      y: d.y,
      speed: d.speed,
      gear: d.gear,
      throttle: d.throttle,
      brake: d.brake,
      rpm: d.rpm,
      drs: d.drs,
      heading: 0, // computed client-side by CarSprite interpolation if needed
      lap: d.lap,
      sector: d.sector,
      compound: d.tyre,
      pit: false,
    };
  }
  return { raceTimeSeconds: raw.timestamp, lap: raw.lap, drivers, weather };
}
