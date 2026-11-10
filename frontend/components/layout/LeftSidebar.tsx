"use client";

import { motion } from "framer-motion";
import { CloudRain, Wind, Droplets, Thermometer, PanelLeftOpen } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { TimingLadder } from "@/components/leaderboard/TimingLadder";

function WeatherPanel() {
  // Backend does not yet stream per-frame weather for the web pipeline (desktop-only so far).
  // Panel renders gracefully once that endpoint/field lands; shows a clear, compact status until then.
  const weather = null as null | {
    airTemp: number;
    trackTemp: number;
    humidity: number;
    windSpeed: number;
    rainfall: boolean;
  };

  if (!weather) {
    return (
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-t border-pitwall-hairline/60 bg-pitwall-surface/30">
        <span className="flex items-center gap-1.5 font-display text-[10px] text-pitwall-text-muted">
          <Thermometer className="h-3 w-3 text-pitwall-telemetry/70" />
          <span>Track Weather</span>
        </span>
        <span className="font-telemetry text-[9px] font-bold text-pitwall-text-muted/60">
          OFFLINE
        </span>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-pitwall-hairline/60 bg-pitwall-surface/40 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="font-display text-[10px] font-bold uppercase tracking-wider text-pitwall-text-muted">
          Track Weather
        </h3>
        <span className="font-telemetry text-[9px] text-pitwall-drs font-bold">
          LIVE
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="flex items-center gap-1.5 rounded bg-pitwall-surface px-2 py-1">
          <Thermometer className="h-3 w-3 text-pitwall-telemetry" />
          <span className="font-telemetry text-[11px] font-tabular">{weather.airTemp.toFixed(1)}°C air</span>
        </div>
        <div className="flex items-center gap-1.5 rounded bg-pitwall-surface px-2 py-1">
          <Thermometer className="h-3 w-3 text-pitwall-telemetry" />
          <span className="font-telemetry text-[11px] font-tabular">{weather.trackTemp.toFixed(1)}°C track</span>
        </div>
        <div className="flex items-center gap-1.5 rounded bg-pitwall-surface px-2 py-1">
          <Droplets className="h-3 w-3 text-pitwall-telemetry" />
          <span className="font-telemetry text-[11px] font-tabular">{weather.humidity.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1.5 rounded bg-pitwall-surface px-2 py-1">
          <Wind className="h-3 w-3 text-pitwall-telemetry" />
          <span className="font-telemetry text-[11px] font-tabular">{weather.windSpeed.toFixed(1)} km/h</span>
        </div>
        <div className="col-span-2 flex items-center gap-1.5 rounded bg-pitwall-surface px-2 py-1">
          <CloudRain className="h-3 w-3 text-pitwall-telemetry" />
          <span className="font-display text-[11px]">{weather.rainfall ? "Raining" : "Dry Track"}</span>
        </div>
      </div>
    </div>
  );
}

export function LeftSidebar() {
  const { preferences, setPreference } = usePreferences();
  const collapsed = preferences.leftSidebarCollapsed;

  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center p-2 bg-pitwall-dock border-r border-pitwall-hairline">
        <button
          onClick={() => setPreference("leftSidebarCollapsed", false)}
          className="rounded-sm p-1.5 text-pitwall-text-muted hover:bg-pitwall-elevated hover:text-white transition-colors"
          title="Expand sidebar"
          aria-label="Expand driver timing ladder"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex w-64 md:w-72 lg:w-[280px] shrink-0 flex-col overflow-hidden bg-pitwall-dock border-r border-pitwall-hairline h-full min-h-0 select-none"
    >
      {/* Unified 20-Car Timing Ladder */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TimingLadder onCollapse={() => setPreference("leftSidebarCollapsed", true)} />
      </div>

      {/* Secondary Information Dock */}
      <WeatherPanel />
    </motion.aside>
  );
}
