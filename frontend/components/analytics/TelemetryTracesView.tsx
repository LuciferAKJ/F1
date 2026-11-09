"use client";

import { memo, useMemo, useState } from "react";
import { Download, Rows3, List, Lock, SlidersHorizontal } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import { useDriverSeries } from "@/hooks/useDriverSeries";
import { usePreferences } from "@/hooks/usePreferences";
import { TelemetryChart } from "@/components/analytics/TelemetryChart";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportCSV } from "@/lib/exportUtils";
import { toast } from "@/store/toastStore";
import { cn } from "@/lib/utils";

const RPM_MAX = 12000;

const UNAVAILABLE_CHANNELS = [
  { title: "ERS Energy Deployment", reason: "Hybrid state-of-charge not streamed by FastF1 pipeline." },
  { title: "Friction Circle / G-Force", reason: "Lateral/longitudinal accelerometer forces unavailable." },
  { title: "Engine Oil / Water Temps", reason: "Power unit thermal telemetry is restricted." },
];

interface TelemetryTracesViewProps {
  race: SelectedRace | null;
  onSeek: (t: number) => void;
}

export const TelemetryTracesView = memo(function TelemetryTracesView({
  race,
  onSeek,
}: TelemetryTracesViewProps) {
  const metadata = useReplayStore((s) => s.metadata);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);
  const seek = useReplayStore((s) => s.seek);

  const { preferences, setPreference } = usePreferences();
  const compact = preferences.compactMode;
  const comparisonEnabled = preferences.comparisonMode;
  const [compareDriver, setCompareDriver] = useState<string | null>(null);
  const [zoomIndices, setZoomIndices] = useState<[number, number] | null>(null);

  // Channel visibility toggles
  const [visibleChannels, setVisibleChannels] = useState<{
    speed: boolean;
    throttle: boolean;
    brake: boolean;
    rpm: boolean;
    gear: boolean;
  }>({
    speed: true,
    throttle: true,
    brake: true,
    rpm: true,
    gear: true,
  });

  const { series: primarySeries, isLoading: primaryLoading } = useDriverSeries(
    race,
    selectedDriver
  );
  const { series: compareSeries } = useDriverSeries(
    race,
    comparisonEnabled ? compareDriver : null
  );

  const driverColor = useMemo(
    () => (abbr: string | null) =>
      metadata?.drivers.find((d) => d.abbreviation === abbr)?.teamColor ?? "#00C8E8",
    [metadata]
  );

  const otherDrivers = useMemo(
    () => metadata?.drivers.filter((d) => d.abbreviation !== selectedDriver) ?? [],
    [metadata, selectedDriver]
  );

  const handleSeek = (t: number) => {
    seek(t);
    onSeek(t);
  };

  const compareActive = comparisonEnabled && compareDriver;
  const primaryChartSeries = {
    data: primarySeries,
    color: driverColor(selectedDriver),
    label: selectedDriver ?? "—",
  };
  const compareChartSeries = compareActive
    ? {
        data: compareSeries,
        color: driverColor(compareDriver),
        label: compareDriver as string,
      }
    : null;

  const handleExportCSV = () => {
    if (!selectedDriver || primarySeries.length === 0) return;
    const rows = primarySeries.map((p) => ({
      timestampSeconds: p.t,
      driver: selectedDriver,
      speedKmh: p.speed,
      throttlePercent: p.throttle,
      brakeOn: p.brake === 100,
      rpm: p.rpm,
      gear: p.gear,
      drsCode: p.drs ?? 0,
      lap: p.lap ?? 0,
    }));
    exportCSV(rows, `${selectedDriver}-telemetry.csv`);
    toast.success(`Exported ${selectedDriver} telemetry as CSV`);
  };

  const toggleChannel = (channel: keyof typeof visibleChannels) => {
    setVisibleChannels((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  };

  if (!selectedDriver) {
    return (
      <div className="flex h-36 items-center justify-center rounded border border-pitwall-hairline bg-pitwall-surface/50 p-4 text-xs text-pitwall-text-muted">
        Select a driver on the timing ladder to inspect synchronized telemetry traces.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Telemetry Channel Controls & Driver Comparison Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-pitwall-surface px-2.5 py-1.5 border border-pitwall-hairline">
        {/* Left: Active Channel Selectors */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-wider text-pitwall-text-muted mr-1.5">
            <SlidersHorizontal className="h-3 w-3 text-pitwall-telemetry" />
            Channels:
          </span>
          {(
            [
              { key: "speed", label: "SPEED" },
              { key: "throttle", label: "THROTTLE" },
              { key: "brake", label: "BRAKE (BINARY)" },
              { key: "rpm", label: "RPM" },
              { key: "gear", label: "GEAR" },
            ] as const
          ).map(({ key, label }) => {
            const active = visibleChannels[key];
            return (
              <button
                key={key}
                onClick={() => toggleChannel(key)}
                className={cn(
                  "px-2 py-0.5 rounded font-display text-[9px] font-bold tracking-wider transition-colors border",
                  active
                    ? "bg-pitwall-elevated border-pitwall-telemetry/40 text-pitwall-text"
                    : "bg-pitwall-dock/60 border-pitwall-hairline/50 text-pitwall-text-muted/60 hover:text-pitwall-text-muted"
                )}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Right: Driver Comparison & Display Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={comparisonEnabled ? "default" : "outline"}
            onClick={() => setPreference("comparisonMode", !comparisonEnabled)}
            className="h-6 px-2 text-[10px] font-display font-bold uppercase tracking-wider"
            aria-pressed={comparisonEnabled}
          >
            {comparisonEnabled ? "COMPARING" : "+ COMPARE DRIVER"}
          </Button>

          {comparisonEnabled && (
            <Select value={compareDriver ?? undefined} onValueChange={setCompareDriver}>
              <SelectTrigger
                className="h-6 w-28 text-[10px] font-telemetry bg-pitwall-dock border-pitwall-hairline"
                aria-label="Comparison driver"
              >
                <SelectValue placeholder="2nd driver" />
              </SelectTrigger>
              <SelectContent className="bg-pitwall-dock border-pitwall-hairline text-pitwall-text text-xs">
                {otherDrivers.map((d) => (
                  <SelectItem key={d.abbreviation} value={d.abbreviation}>
                    {d.abbreviation} ({d.teamName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="icon"
            variant="outline"
            onClick={() => setPreference("compactMode", !compact)}
            title={compact ? "Expand charts" : "Compact mode"}
            aria-label={compact ? "Expand charts" : "Compact mode"}
            className="h-6 w-6 border-pitwall-hairline bg-pitwall-dock text-pitwall-text-muted hover:text-white"
          >
            {compact ? <Rows3 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={handleExportCSV}
            title="Export telemetry as CSV"
            aria-label="Export telemetry as CSV"
            className="h-6 w-6 border-pitwall-hairline bg-pitwall-dock text-pitwall-text-muted hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Synchronized Recharts Grid */}
      {primaryLoading && (
        <div className="flex h-40 items-center justify-center font-display text-xs text-pitwall-text-muted">
          Loading full-session telemetry buffer…
        </div>
      )}

      {!primaryLoading && (
        <div
          className={
            compact
              ? "grid grid-cols-1 gap-2 md:grid-cols-2"
              : "grid grid-cols-1 gap-2.5 lg:grid-cols-2"
          }
        >
          {visibleChannels.speed && (
            <TelemetryChart
              title="Speed"
              unit="km/h"
              dataKey="speed"
              variant="line"
              primary={primaryChartSeries}
              compare={compareChartSeries}
              cursorTime={currentTimestamp}
              zoomIndices={zoomIndices}
              onZoomIndicesChange={setZoomIndices}
              onSeek={handleSeek}
              yDomain={[0, 360]}
              showBrush
              compact={compact}
            />
          )}

          {visibleChannels.throttle && (
            <TelemetryChart
              title="Throttle"
              unit="%"
              dataKey="throttle"
              variant="area"
              primary={primaryChartSeries}
              compare={compareChartSeries}
              cursorTime={currentTimestamp}
              zoomIndices={zoomIndices}
              onZoomIndicesChange={setZoomIndices}
              onSeek={handleSeek}
              yDomain={[0, 100]}
              compact={compact}
            />
          )}

          {visibleChannels.brake && (
            <TelemetryChart
              title="Brake (Binary: On/Off)"
              dataKey="brake"
              variant="step"
              primary={primaryChartSeries}
              compare={compareChartSeries}
              cursorTime={currentTimestamp}
              zoomIndices={zoomIndices}
              onZoomIndicesChange={setZoomIndices}
              onSeek={handleSeek}
              yDomain={[0, 100]}
              yTicks={[0, 100]}
              compact={compact}
            />
          )}

          {visibleChannels.rpm && (
            <TelemetryChart
              title="Engine RPM"
              dataKey="rpm"
              variant="line"
              primary={primaryChartSeries}
              compare={compareChartSeries}
              cursorTime={currentTimestamp}
              zoomIndices={zoomIndices}
              onZoomIndicesChange={setZoomIndices}
              onSeek={handleSeek}
              yDomain={[0, RPM_MAX]}
              redlineFrom={RPM_MAX * 0.88}
              compact={compact}
            />
          )}

          {visibleChannels.gear && (
            <TelemetryChart
              title="Gear Ratio"
              dataKey="gear"
              variant="step"
              primary={primaryChartSeries}
              compare={compareChartSeries}
              cursorTime={currentTimestamp}
              zoomIndices={zoomIndices}
              onZoomIndicesChange={setZoomIndices}
              onSeek={handleSeek}
              yDomain={[0, 8]}
              yTicks={[0, 1, 2, 3, 4, 5, 6, 7, 8]}
              compact={compact}
            />
          )}
        </div>
      )}

      {/* Unavailable Channels & Telemetry Integrity Footer */}
      <div className="grid grid-cols-1 gap-2 border-t border-pitwall-hairline pt-2 sm:grid-cols-3">
        {UNAVAILABLE_CHANNELS.map((item) => (
          <div
            key={item.title}
            className="flex flex-col gap-0.5 rounded border border-pitwall-hairline/60 bg-pitwall-dock/40 p-1.5"
          >
            <span className="flex items-center gap-1 font-display text-[10px] font-bold text-pitwall-text-muted">
              <Lock className="h-2.5 w-2.5 text-amber-500/70" /> {item.title}
            </span>
            <span className="font-body text-[9px] leading-tight text-pitwall-text-muted/60">
              {item.reason}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[9px] text-pitwall-text-muted/60 font-body px-1">
        <span>Click chart or drag scrubber to seek replay time. Double-click any chart to reset zoom range.</span>
        <span>Telemetry density: FastF1 frame stream (~0.5s interval). Brake is a binary state channel (BRAKE ON / OFF).</span>
      </div>
    </div>
  );
});

