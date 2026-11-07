"use client";

import { motion } from "framer-motion";
import { Crosshair, CloudRain, Wind, Droplets, Thermometer, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import { usePreferences } from "@/hooks/usePreferences";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function DriverList() {
  const metadata = useReplayStore((s) => s.metadata);
  const selectedRace = useReplayStore((s) => s.selectedRace);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const followedDriver = useReplayStore((s) => s.followedDriver);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);
  const pixiControls = useReplayStore((s) => s.pixiControls);

  const pathname = usePathname();
  const isDemo = Boolean(
    pathname?.includes("/replay/demo") ||
    metadata?.isDemo ||
    metadata?.info?.isDemo ||
    selectedRace?.year === 0 ||
    selectedRace?.event?.toLowerCase().includes("demo")
  );

  const drivers = metadata?.drivers ?? [];

  const handleSelect = (abbr: string) => {
    setSelectedDriver(abbr);
    // If follow mode is currently active, update the followed driver to follow newly selected driver
    if (followedDriver) {
      pixiControls?.followDriver(abbr);
    }
  };

  const handleToggleFollow = (e: React.MouseEvent, abbr: string) => {
    e.stopPropagation();
    if (followedDriver === abbr) {
      pixiControls?.stopFollowing();
      pixiControls?.resetView();
    } else {
      setSelectedDriver(abbr);
      pixiControls?.followDriver(abbr);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-border bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Drivers</h3>
        {isDemo ? (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-400 border border-amber-500/30">
            DEMO
          </span>
        ) : (
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-emerald-400 border border-emerald-500/30">
            REAL
          </span>
        )}
      </div>
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {drivers.length === 0 && <p className="text-xs text-muted">Loading drivers…</p>}
        {drivers.map((d) => (
          <div
            key={d.abbreviation}
            className={cn(
              "group flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-black/40",
              selectedDriver === d.abbreviation && "bg-black/50 ring-1 ring-accent"
            )}
          >
            <button
              onClick={() => handleSelect(d.abbreviation)}
              aria-pressed={selectedDriver === d.abbreviation}
              aria-label={`Select ${d.abbreviation}, ${d.teamName}`}
              className="flex flex-1 items-center gap-2 overflow-hidden text-left"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/40"
                style={{ backgroundColor: d.teamColor }}
                aria-hidden="true"
              />
              <span className="font-semibold">{d.abbreviation}</span>
              <span className="truncate text-xs text-muted">{d.teamName}</span>
            </button>
            <button
              onClick={(e) => handleToggleFollow(e, d.abbreviation)}
              className={cn(
                "rounded p-1 transition-colors hover:bg-white/10",
                followedDriver === d.abbreviation
                  ? "text-accent bg-accent/20"
                  : selectedDriver === d.abbreviation
                  ? "text-muted hover:text-white"
                  : "opacity-0 group-hover:opacity-100 text-muted hover:text-white"
              )}
              title={followedDriver === d.abbreviation ? `Following ${d.abbreviation} — click to return to overview` : `Follow ${d.abbreviation}`}
              aria-label={followedDriver === d.abbreviation ? `Stop following ${d.abbreviation}` : `Follow ${d.abbreviation}`}
            >
              <Crosshair className="h-3.5 w-3.5" />
            </button>
          </div>
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
      <div className="flex w-10 shrink-0 flex-col items-center p-2 bg-pitwall-dock border-r border-pitwall-hairline">
        <button
          onClick={() => setPreference("leftSidebarCollapsed", false)}
          className="rounded-md p-1.5 text-pitwall-text-muted hover:bg-pitwall-elevated hover:text-white"
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
      className="flex w-64 md:w-70 lg:w-[270px] shrink-0 flex-col gap-3 overflow-y-auto p-3 bg-pitwall-dock border-r border-pitwall-hairline"
    >
      <div className="flex justify-end">
        <button
          onClick={() => setPreference("leftSidebarCollapsed", true)}
          className="rounded-md p-1 text-pitwall-text-muted hover:bg-pitwall-elevated hover:text-white"
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
