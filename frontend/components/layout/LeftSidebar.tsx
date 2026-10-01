"use client";

import { motion } from "framer-motion";
import { Crosshair, CloudRain, Wind, Droplets, Thermometer, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import { usePreferences } from "@/hooks/usePreferences";
import { cn } from "@/lib/utils";

function DriverList() {
  const metadata = useReplayStore((s) => s.metadata);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);
  const pixiControls = useReplayStore((s) => s.pixiControls);

  const drivers = metadata?.drivers ?? [];

  const handleSelect = (abbr: string) => {
    setSelectedDriver(abbr);
    pixiControls?.followDriver(abbr);
  };

  return (
    <div className="flex flex-col rounded-xl border border-border bg-panel p-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Drivers</h3>
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {drivers.length === 0 && <p className="text-xs text-muted">Loading drivers…</p>}
        {drivers.map((d) => (
          <button
            key={d.abbreviation}
            onClick={() => handleSelect(d.abbreviation)}
            aria-pressed={selectedDriver === d.abbreviation}
            aria-label={`Select and follow ${d.abbreviation}, ${d.teamName}`}
            className={cn(
              "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-black/40",
              selectedDriver === d.abbreviation && "bg-black/50 ring-1 ring-accent"
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full border border-black/40"
                style={{ backgroundColor: d.teamColor }}
                aria-hidden="true"
              />
              <span className="font-semibold">{d.abbreviation}</span>
              <span className="text-xs text-muted">{d.teamName}</span>
            </span>
            {selectedDriver === d.abbreviation && <Crosshair className="h-3.5 w-3.5 text-accent" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function WeatherPanel() {
  // Backend does not yet stream per-frame weather for the web pipeline (desktop-only so far).
  // Panel renders gracefully once that endpoint/field lands; shows a clear "unavailable" state until then.
  const weather = null as null | {
    airTemp: number; trackTemp: number; humidity: number; windSpeed: number; rainfall: boolean;
  };

  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Weather</h3>
      {!weather && <p className="text-xs text-muted">Weather data not available for this session yet.</p>}
      {weather && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 rounded-md bg-black/30 px-2 py-1.5">
            <Thermometer className="h-3.5 w-3.5 text-accent" />
            <span>{weather.airTemp.toFixed(1)}°C air</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-black/30 px-2 py-1.5">
            <Thermometer className="h-3.5 w-3.5 text-accent" />
            <span>{weather.trackTemp.toFixed(1)}°C track</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-black/30 px-2 py-1.5">
            <Droplets className="h-3.5 w-3.5 text-accent" />
            <span>{weather.humidity.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-black/30 px-2 py-1.5">
            <Wind className="h-3.5 w-3.5 text-accent" />
            <span>{weather.windSpeed.toFixed(1)} km/h</span>
          </div>
          <div className="col-span-2 flex items-center gap-1.5 rounded-md bg-black/30 px-2 py-1.5">
            <CloudRain className="h-3.5 w-3.5 text-accent" />
            <span>{weather.rainfall ? "Raining" : "Dry"}</span>
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
      <div className="flex w-10 shrink-0 flex-col items-center p-2">
        <button
          onClick={() => setPreference("leftSidebarCollapsed", false)}
          className="rounded-md p-1.5 text-muted hover:bg-black/40 hover:text-white"
          title="Expand sidebar"
          aria-label="Expand driver and weather sidebar"
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
      className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto p-3"
    >
      <div className="flex justify-end">
        <button
          onClick={() => setPreference("leftSidebarCollapsed", true)}
          className="rounded-md p-1 text-muted hover:bg-black/40 hover:text-white"
          title="Collapse sidebar"
          aria-label="Collapse driver and weather sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <DriverList />
      <WeatherPanel />
    </motion.aside>
  );
}
