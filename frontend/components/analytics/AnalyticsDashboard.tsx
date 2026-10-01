"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Lock, Rows3, List, Download } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import { useDriverSeries } from "@/hooks/useDriverSeries";
import { usePreferences } from "@/hooks/usePreferences";
import { TelemetryChart } from "@/components/analytics/TelemetryChart";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { exportCSV } from "@/lib/exportUtils";
import { toast } from "@/store/toastStore";

const RPM_MAX = 12000; // same assumed visualization scale used by the telemetry dashboard

const UNAVAILABLE_ANALYTICS = [
  { title: "Lap Delta", reason: "Needs per-lap official lap times; the replay pipeline only exposes live position, not timed laps." },
  { title: "Sector Comparison", reason: "Needs per-sector timing splits; only the current sector index is streamed, not sector durations." },
  { title: "Tyre Strategy", reason: "Needs pit in/out timestamps across the race; not captured by the current telemetry pipeline." },
  { title: "Pit Stop Timeline", reason: "Needs pit lane entry/exit events; no pit-lane data is exposed by the backend yet." },
];

interface AnalyticsDashboardProps {
  race: SelectedRace | null;
  onSeek: (t: number) => void;
}

export function AnalyticsDashboard({ race, onSeek }: AnalyticsDashboardProps) {
  const metadata = useReplayStore((s) => s.metadata);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);
  const seek = useReplayStore((s) => s.seek);

  const [expanded, setExpanded] = useState(false);
  const { preferences, setPreference } = usePreferences();
  const compact = preferences.compactMode;
  const comparisonEnabled = preferences.comparisonMode;
  const [compareDriver, setCompareDriver] = useState<string | null>(null);
  const [zoomIndices, setZoomIndices] = useState<[number, number] | null>(null);

  const { series: primarySeries } = useDriverSeries(race, selectedDriver);
  const { series: compareSeries } = useDriverSeries(
    race,
    comparisonEnabled ? compareDriver : null
  );

  const driverColor = useMemo(
    () => (abbr: string | null) => metadata?.drivers.find((d) => d.abbreviation === abbr)?.teamColor ?? "#8a8a8a",
    [metadata]
  );

  const handleSeek = (t: number) => {
    seek(t); // immediate local UI feedback
    onSeek(t); // mirror to the WebSocket so playback stays in sync
  };

  const otherDrivers = useMemo(
    () => metadata?.drivers.filter((d) => d.abbreviation !== selectedDriver) ?? [],
    [metadata, selectedDriver]
  );

  const compareActive = comparisonEnabled && compareDriver;
  const primaryChartSeries = { data: primarySeries, color: driverColor(selectedDriver), label: selectedDriver ?? "—" };
  const compareChartSeries = compareActive
    ? { data: compareSeries, color: driverColor(compareDriver), label: compareDriver as string }
    : null;

  const handleExportCSV = () => {
    if (!selectedDriver || primarySeries.length === 0) return;
    const rows = primarySeries.map((p) => ({
      timestampSeconds: p.t, driver: selectedDriver, speedKmh: p.speed,
      throttlePercent: p.throttle, brakeOn: p.brake === 100, rpm: p.rpm, gear: p.gear,
    }));
    exportCSV(rows, `${selectedDriver}-telemetry.csv`);
    toast.success(`Exported ${selectedDriver} telemetry as CSV`);
  };

  if (!selectedDriver) {
    return (
      <div className="rounded-xl border border-border bg-panel p-3 text-xs text-muted">
        Select a driver to view telemetry analytics.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted hover:text-white"
          aria-expanded={expanded}
          aria-controls="analytics-dashboard-content"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          Telemetry Analytics
        </button>

        {expanded && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={comparisonEnabled ? "default" : "outline"}
              onClick={() => setPreference("comparisonMode", !comparisonEnabled)}
              aria-pressed={comparisonEnabled}
            >
              Compare drivers
            </Button>

            {comparisonEnabled && (
              <Select value={compareDriver ?? undefined} onValueChange={setCompareDriver}>
                <SelectTrigger className="h-8 w-32 text-xs" aria-label="Comparison driver">
                  <SelectValue placeholder="2nd driver" />
                </SelectTrigger>
                <SelectContent>
                  {otherDrivers.map((d) => (
                    <SelectItem key={d.abbreviation} value={d.abbreviation}>
                      {d.abbreviation} — {d.teamName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              size="icon" variant="outline"
              onClick={() => setPreference("compactMode", !compact)}
              title={compact ? "Expand charts" : "Compact mode"}
              aria-pressed={compact}
              aria-label={compact ? "Expand charts" : "Compact mode"}
            >
              {compact ? <Rows3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </Button>

            <Button
              size="icon" variant="outline" onClick={handleExportCSV}
              title="Export telemetry as CSV" aria-label="Export telemetry as CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="analytics-dashboard-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
          <div className="mt-3 flex flex-col gap-3">
            <div className={compact ? "grid grid-cols-1 gap-2 md:grid-cols-2" : "grid grid-cols-1 gap-3 lg:grid-cols-2"}>
            <TelemetryChart
              title="Speed" unit="km/h" dataKey="speed" variant="line"
              primary={primaryChartSeries} compare={compareChartSeries}
              cursorTime={currentTimestamp} zoomIndices={zoomIndices}
              onZoomIndicesChange={setZoomIndices} onSeek={handleSeek}
              yDomain={[0, 360]} showBrush compact={compact}
            />
            <TelemetryChart
              title="Throttle" unit="%" dataKey="throttle" variant="area"
              primary={primaryChartSeries} compare={compareChartSeries}
              cursorTime={currentTimestamp} zoomIndices={zoomIndices}
              onZoomIndicesChange={setZoomIndices} onSeek={handleSeek}
              yDomain={[0, 100]} compact={compact}
            />
            <TelemetryChart
              title="Brake (on/off)" dataKey="brake" variant="step"
              primary={primaryChartSeries} compare={compareChartSeries}
              cursorTime={currentTimestamp} zoomIndices={zoomIndices}
              onZoomIndicesChange={setZoomIndices} onSeek={handleSeek}
              yDomain={[0, 100]} yTicks={[0, 100]} compact={compact}
            />
            <TelemetryChart
              title="RPM" dataKey="rpm" variant="line"
              primary={primaryChartSeries} compare={compareChartSeries}
              cursorTime={currentTimestamp} zoomIndices={zoomIndices}
              onZoomIndicesChange={setZoomIndices} onSeek={handleSeek}
              yDomain={[0, RPM_MAX]} redlineFrom={RPM_MAX * 0.88} compact={compact}
            />
            <TelemetryChart
              title="Gear" dataKey="gear" variant="step"
              primary={primaryChartSeries} compare={compareChartSeries}
              cursorTime={currentTimestamp} zoomIndices={zoomIndices}
              onZoomIndicesChange={setZoomIndices} onSeek={handleSeek}
              yDomain={[0, 8]} yTicks={[0, 1, 2, 3, 4, 5, 6, 7, 8]} compact={compact}
            />
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
            {UNAVAILABLE_ANALYTICS.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-1 rounded-lg border border-border bg-black/20 p-2 opacity-60"
              >
                <span className="flex items-center gap-1 text-[11px] font-bold">
                  <Lock className="h-3 w-3" /> {item.title}
                </span>
                <span className="text-[10px] leading-tight text-muted">{item.reason}</span>
              </div>
            ))}
            </div>

            <p className="text-[10px] leading-tight text-muted/70">
              Click a chart to seek, drag to scrub, double-click to reset zoom, or drag the
              handles under the Speed chart — all charts zoom together. Brake is shown as
              on/off (the pipeline only has a boolean flag, not pressure). RPM&apos;s redline
              band assumes a 12,000 RPM scale for visualization only.
            </p>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
