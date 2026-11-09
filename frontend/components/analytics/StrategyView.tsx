"use client";

import { memo, useMemo } from "react";
import { CircleDot, Lock, Layers, AlertCircle } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import { cn } from "@/lib/utils";

interface StrategyViewProps {
  race: SelectedRace | null;
  onSeek: (t: number) => void;
}

interface DriverStintSummary {
  abbreviation: string;
  driverNumber: string;
  teamName: string;
  teamColor: string;
  currentCompound: string;
  estimatedTyreAge: number;
  currentLap: number;
  position: number;
}

const COMPOUND_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SOFT: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/40" },
  MEDIUM: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40" },
  HARD: { bg: "bg-slate-200/15", text: "text-slate-200", border: "border-slate-300/40" },
  INTERMEDIATE: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40" },
  INTER: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40" },
  WET: { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/40" },
};

const UNAVAILABLE_STRATEGY_METRICS = [
  { title: "Tyre Degradation Curves", reason: "Real-time rubber wear models and degradation percentages are proprietary." },
  { title: "Pit Window Forecasting", reason: "Predictive undercut/overcut windows require simulation feeds." },
  { title: "Fuel Consumption & Load", reason: "Fuel mass and fuel flow rates are restricted telemetry." },
  { title: "Remaining Tyre Life %", reason: "Estimates are strictly restricted to observed lap counts, never fabricated wear %." },
];

export const StrategyView = memo(function StrategyView({ race, onSeek }: StrategyViewProps) {
  const metadata = useReplayStore((s) => s.metadata);
  const currentFrame = useReplayStore((s) => s.currentFrame);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);

  // Compute current stint state across all drivers in the session
  const driverStints = useMemo<DriverStintSummary[]>(() => {
    if (!metadata?.drivers) return [];

    return metadata.drivers.map((d, index) => {
      // Find driver frame in current active frame
      const frameDriver = currentFrame?.drivers?.find((df) => df.driverId === d.abbreviation);
      const compound = (frameDriver?.tyre ?? "MEDIUM").toUpperCase();
      const currentLap = frameDriver?.lap ?? 1;

      // In real-time broadcast, tyre age is estimated based on laps run on the current compound
      // If no pit stop occurred yet, tyre age equals the current race lap.
      const estimatedTyreAge = Math.max(1, currentLap);

      return {
        abbreviation: d.abbreviation,
        driverNumber: d.driverNumber,
        teamName: d.teamName,
        teamColor: d.teamColor,
        currentCompound: compound,
        estimatedTyreAge,
        currentLap,
        position: index + 1,
      };
    });
  }, [metadata, currentFrame]);

  const activeDriverStint = useMemo(
    () => driverStints.find((d) => d.abbreviation === selectedDriver) ?? driverStints[0] ?? null,
    [driverStints, selectedDriver]
  );

  const getCompoundStyle = (compound: string) => {
    const key = compound.toUpperCase();
    return (
      COMPOUND_COLORS[key] ?? {
        bg: "bg-pitwall-elevated",
        text: "text-pitwall-text",
        border: "border-pitwall-hairline",
      }
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Top Section: Active Driver Strategy Spotlight */}
      {activeDriverStint && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          {/* Spotlight Card */}
          <div className="flex flex-col gap-1 rounded border border-pitwall-hairline bg-pitwall-surface p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-display text-[10px] font-bold uppercase tracking-wider text-pitwall-text-muted">
                Spotlight Driver
              </span>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: activeDriverStint.teamColor }}
              />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-lg font-black text-pitwall-text">
                {activeDriverStint.abbreviation}
              </span>
              <span className="font-telemetry text-xs text-pitwall-text-muted">
                #{activeDriverStint.driverNumber} · {activeDriverStint.teamName}
              </span>
            </div>
          </div>

          {/* Active Compound */}
          <div className="flex flex-col gap-1 rounded border border-pitwall-hairline bg-pitwall-surface p-2.5">
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-pitwall-text-muted">
              Current Compound
            </span>
            <div className="flex items-center gap-2">
              {(() => {
                const style = getCompoundStyle(activeDriverStint.currentCompound);
                return (
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded font-display text-xs font-black uppercase tracking-wider border",
                      style.bg,
                      style.text,
                      style.border
                    )}
                  >
                    {activeDriverStint.currentCompound}
                  </span>
                );
              })()}
              <span className="font-telemetry text-[10px] text-pitwall-text-muted">
                Active Stint
              </span>
            </div>
          </div>

          {/* Estimated Tyre Age */}
          <div className="flex flex-col gap-1 rounded border border-pitwall-hairline bg-pitwall-surface p-2.5">
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-pitwall-text-muted">
              Estimated Tyre Age
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-telemetry text-lg font-bold text-pitwall-text font-tabular">
                {activeDriverStint.estimatedTyreAge}L
              </span>
              <span className="font-telemetry text-[10px] text-pitwall-text-muted">
                (est. laps on compound)
              </span>
            </div>
          </div>

          {/* Stint Overview */}
          <div className="flex flex-col gap-1 rounded border border-pitwall-hairline bg-pitwall-surface p-2.5">
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-pitwall-text-muted">
              Race Distance
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-telemetry text-lg font-bold text-pitwall-text font-tabular">
                Lap {activeDriverStint.currentLap}
              </span>
              <span className="font-telemetry text-[10px] text-pitwall-text-muted">
                / {metadata?.totalLaps ?? "—"} Total
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Grid: 20-Car Stint & Tyre Status Matrix */}
      <div className="flex flex-col rounded border border-pitwall-hairline bg-pitwall-surface overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 bg-pitwall-dock border-b border-pitwall-hairline">
          <div className="flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-pitwall-text">
            <Layers className="h-3 w-3 text-pitwall-telemetry" />
            Field Tyre & Stint Matrix
          </div>
          <span className="font-telemetry text-[9px] text-pitwall-text-muted">
            Click driver to inspect telemetry
          </span>
        </div>

        <div className="max-h-48 overflow-y-auto">
          <table className="w-full border-collapse text-left font-telemetry text-xs">
            <thead>
              <tr className="border-b border-pitwall-hairline/60 bg-pitwall-dock/40 text-[9px] uppercase tracking-wider text-pitwall-text-muted">
                <th className="py-1 px-3 w-12">POS</th>
                <th className="py-1 px-3">DRIVER</th>
                <th className="py-1 px-3">CONSTRUCTOR</th>
                <th className="py-1 px-3">COMPOUND</th>
                <th className="py-1 px-3">TYRE AGE (EST.)</th>
                <th className="py-1 px-3">STINT VISUAL</th>
              </tr>
            </thead>
            <tbody>
              {driverStints.map((d) => {
                const isSelected = d.abbreviation === selectedDriver;
                const style = getCompoundStyle(d.currentCompound);
                const totalLaps = metadata?.totalLaps ?? 57;
                const stintPercent = Math.min(100, Math.max(5, (d.estimatedTyreAge / totalLaps) * 100));

                return (
                  <tr
                    key={d.abbreviation}
                    onClick={() => setSelectedDriver(d.abbreviation)}
                    className={cn(
                      "border-b border-pitwall-hairline/30 transition-colors cursor-pointer text-[11px]",
                      isSelected
                        ? "bg-pitwall-elevated/70"
                        : "hover:bg-pitwall-elevated/40"
                    )}
                  >
                    <td className="py-1 px-3 font-bold text-pitwall-text-muted">
                      P{d.position}
                    </td>

                    <td className="py-1 px-3">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span
                          className="h-2 w-1 rounded-xs"
                          style={{ backgroundColor: d.teamColor }}
                        />
                        <span className={isSelected ? "text-pitwall-telemetry" : "text-pitwall-text"}>
                          {d.abbreviation}
                        </span>
                        <span className="text-[9px] text-pitwall-text-muted font-normal">
                          #{d.driverNumber}
                        </span>
                      </div>
                    </td>

                    <td className="py-1 px-3 text-[10px] text-pitwall-text-muted">
                      {d.teamName}
                    </td>

                    <td className="py-1 px-3">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded font-display text-[9px] font-bold uppercase tracking-wider border",
                          style.bg,
                          style.text,
                          style.border
                        )}
                      >
                        {d.currentCompound}
                      </span>
                    </td>

                    <td className="py-1 px-3 font-tabular text-pitwall-text">
                      {d.estimatedTyreAge} Laps{" "}
                      <span className="text-[9px] text-pitwall-text-muted font-normal">est.</span>
                    </td>

                    <td className="py-1 px-3 w-40">
                      <div className="w-full h-2 rounded bg-pitwall-dock overflow-hidden border border-pitwall-hairline/60">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${stintPercent}%`,
                            backgroundColor: d.teamColor || "#00C8E8",
                          }}
                          title={`Stint: ${d.estimatedTyreAge} laps on ${d.currentCompound}`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unavailable Strategy Models Disclosure */}
      <div className="grid grid-cols-1 gap-2 border-t border-pitwall-hairline pt-2 sm:grid-cols-2 lg:grid-cols-4">
        {UNAVAILABLE_STRATEGY_METRICS.map((item) => (
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
        <span>Tyre age is estimated from observed compound frames. Degradation % and wear curves are omitted.</span>
        <span>Strategy simulation predictions are restricted. Official pit stop times are unavailable.</span>
      </div>
    </div>
  );
});
