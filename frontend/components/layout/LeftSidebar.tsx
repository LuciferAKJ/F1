"use client";

import { motion } from "framer-motion";
import { CloudRain, Wind, Droplets, Thermometer, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { TimingLadder } from "@/components/leaderboard/TimingLadder";

function WeatherPanel() {
  // Backend does not yet stream per-frame weather for the web pipeline (desktop-only so far).
  // Panel renders gracefully once that endpoint/field lands; shows a clear "unavailable" state until then.
  const weather = null as null | {
    airTemp: number;
    trackTemp: number;
    humidity: number;
    windSpeed: number;
    rainfall: boolean;
  };

  return (
    <div className="shrink-0 rounded-sm border border-pitwall-hairline bg-pitwall-dock p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="font-display text-[10px] font-bold uppercase tracking-wider text-pitwall-text-muted">
          Track Weather
        </h3>
        <span className="font-telemetry text-[9px] text-pitwall-text-muted/60">
          OFFLINE
        </span>
      </div>
      {!weather && (
        <p className="font-display text-[11px] text-pitwall-text-muted">
          Weather telemetry unavailable for this session.
        </p>
      )}
      {weather && (
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 rounded-sm bg-pitwall-surface px-2 py-1">
            <Thermometer className="h-3 w-3 text-pitwall-telemetry" />
            <span className="font-telemetry text-[11px] font-tabular">{weather.airTemp.toFixed(1)}°C air</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-sm bg-pitwall-surface px-2 py-1">
            <Thermometer className="h-3 w-3 text-pitwall-telemetry" />
            <span className="font-telemetry text-[11px] font-tabular">{weather.trackTemp.toFixed(1)}°C track</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-sm bg-pitwall-surface px-2 py-1">
            <Droplets className="h-3 w-3 text-pitwall-telemetry" />
            <span className="font-telemetry text-[11px] font-tabular">{weather.humidity.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-sm bg-pitwall-surface px-2 py-1">
            <Wind className="h-3 w-3 text-pitwall-telemetry" />
            <span className="font-telemetry text-[11px] font-tabular">{weather.windSpeed.toFixed(1)} km/h</span>
          </div>
          <div className="col-span-2 flex items-center gap-1.5 rounded-sm bg-pitwall-surface px-2 py-1">
            <CloudRain className="h-3 w-3 text-pitwall-telemetry" />
            <span className="font-display text-[11px]">{weather.rainfall ? "Raining" : "Dry Track"}</span>
          </div>
        </div>
      )}
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
          className="rounded-sm p-1.5 text-pitwall-text-muted hover:bg-pitwall-elevated hover:text-white"
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
      className="flex w-64 md:w-72 lg:w-[286px] shrink-0 flex-col gap-2 overflow-hidden p-2 bg-pitwall-dock border-r border-pitwall-hairline h-full min-h-0"
    >
      <div className="flex items-center justify-between pb-1 border-b border-pitwall-hairline/60 shrink-0">
        <span className="font-display font-bold text-[10px] tracking-wider uppercase text-pitwall-text-muted">
          Pit-Wall Left Dock
        </span>
        <button
          onClick={() => setPreference("leftSidebarCollapsed", true)}
          className="rounded-sm p-1 text-pitwall-text-muted hover:bg-pitwall-elevated hover:text-white"
          title="Collapse sidebar"
          aria-label="Collapse driver timing ladder"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Unified 20-Car Timing Ladder */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TimingLadder />
      </div>

      {/* Secondary Information Dock */}
      <WeatherPanel />
    </motion.aside>
  );
}
