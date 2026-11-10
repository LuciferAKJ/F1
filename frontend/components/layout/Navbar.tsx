"use client";

import { useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Flag, Play } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const selectedRace = useReplayStore((s) => s.selectedRace);
  const metadata = useReplayStore((s) => s.metadata);
  const currentLap = useReplayStore((s) => s.currentLap);

  const isDemo = Boolean(
    pathname?.includes("/replay/demo") ||
    metadata?.isDemo ||
    metadata?.info?.isDemo ||
    selectedRace?.year === 0 ||
    selectedRace?.event?.toLowerCase().includes("demo")
  );

  const eventTitle = useMemo(() => {
    if (isDemo) return "Demo Grand Prix";
    if (selectedRace?.event) {
      return `${selectedRace.year} ${selectedRace.event}`;
    }
    return "Formula 1 Grand Prix";
  }, [isDemo, selectedRace]);

  const sessionLabel = useMemo(() => {
    const s = selectedRace?.sessionType;
    if (s === "R") return "Race";
    if (s === "Q") return "Qualifying";
    if (s === "S") return "Sprint";
    if (s?.startsWith("FP")) return `FP${s.slice(2)}`;
    return "Session";
  }, [selectedRace?.sessionType]);

  const frameInterval = metadata?.frameInterval ?? 0.5;
  const streamRate = frameInterval > 0 ? (1 / frameInterval).toFixed(1) : "2.0";
  const totalLaps = metadata?.totalLaps ?? metadata?.info?.totalLaps ?? null;

  return (
    <header className="flex h-11 w-full shrink-0 items-center justify-between border-b border-pitwall-hairline bg-pitwall-dock px-3 text-xs select-none z-30">
      {/* LEFT: Identity + Grand Prix */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex h-5 w-6 items-center justify-center rounded bg-pitwall-signal">
            <span className="font-display text-[11px] font-black italic tracking-tighter text-white">F1</span>
          </div>
          <span className="font-display text-xs sm:text-sm font-black tracking-wider text-pitwall-text uppercase">
            REPLAY
          </span>
          <span className="hidden lg:inline-block rounded border border-pitwall-hairline bg-pitwall-surface px-1.5 py-0.5 text-[9px] font-telemetry tracking-wide text-pitwall-telemetry font-bold">
            PIT-WALL WORKSTATION
          </span>
        </div>

        <div className="h-3.5 w-px bg-pitwall-hairline shrink-0" />

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-display text-xs font-bold text-pitwall-text truncate max-w-[130px] sm:max-w-[200px] md:max-w-none">
            {eventTitle}
          </span>
          <span className="hidden sm:inline-block rounded bg-pitwall-surface px-1.5 py-0.5 text-[9px] font-display font-bold uppercase text-pitwall-text-muted border border-pitwall-hairline shrink-0">
            {sessionLabel}
          </span>
        </div>
      </div>

      {/* CENTRE: Lap Status & Circuit Info */}
      <div className="hidden md:flex items-center gap-3">
        {totalLaps ? (
          <div className="flex items-center gap-1.5 font-telemetry font-bold text-xs text-pitwall-text bg-pitwall-surface/80 border border-pitwall-hairline px-2.5 py-0.5 rounded font-tabular">
            <span className="text-pitwall-text-muted text-[10px] tracking-wider uppercase font-display">LAP</span>
            <span className="text-pitwall-telemetry">{currentLap}</span>
            <span className="text-pitwall-hairline">/</span>
            <span>{totalLaps}</span>
          </div>
        ) : null}
        {metadata?.circuit?.minX !== undefined && (
          <div className="hidden xl:flex items-center gap-1 text-[10px] font-telemetry text-pitwall-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-pitwall-hairline" />
            <span className="uppercase">{metadata.info?.sessionName || "CIRCUIT TELEMETRY"}</span>
          </div>
        )}
      </div>

      {/* RIGHT: Data source badge, Replay stream rate, Navigation */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {isDemo ? (
          <div
            className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-telemetry font-bold text-amber-400"
            title="Demonstration dataset - Synthetic track telemetry"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>DEMO DATA</span>
          </div>
        ) : (
          <div
            className="hidden sm:flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-telemetry font-bold text-emerald-400"
            title="Real telemetry from official FastF1 timing"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>REAL DATA</span>
          </div>
        )}

        {/* Stream Frequency */}
        <div
          className="hidden xl:flex items-center gap-1.5 rounded border border-pitwall-hairline bg-pitwall-surface px-2 py-0.5 text-[10px] font-telemetry text-pitwall-text-muted"
          title={`Replay sampling rate: ${frameInterval}s (${streamRate}Hz), 60 FPS client interpolation`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-pitwall-telemetry animate-pulse" />
          <span>{streamRate}Hz</span>
        </div>

        {/* Change Race Button */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1 rounded border border-pitwall-hairline bg-pitwall-surface px-2 py-1 text-[11px] font-display font-bold uppercase tracking-wider text-pitwall-text hover:bg-pitwall-elevated hover:text-white transition-colors"
          title="Change Season or Grand Prix"
          aria-label="Change Season or Grand Prix"
        >
          <Flag className="h-3 w-3 text-pitwall-signal" />
          <span className="hidden sm:inline">RACES</span>
        </button>

        {/* Quick Demo Switcher */}
        {isDemo ? (
          <button
            onClick={() => router.push("/")}
            className="hidden md:flex items-center gap-1 rounded border border-pitwall-hairline bg-pitwall-surface px-2 py-1 text-[11px] font-display font-bold uppercase tracking-wider text-pitwall-text-muted hover:text-pitwall-text hover:bg-pitwall-elevated transition-colors"
            title="Select a Real Grand Prix"
          >
            <Play className="h-3 w-3" />
            <span>REAL GP</span>
          </button>
        ) : (
          <button
            onClick={() => router.push("/replay/demo")}
            className="hidden md:flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-display font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 transition-colors"
            title="Try Instant Demo Replay"
          >
            <Play className="h-3 w-3 fill-amber-300" />
            <span>DEMO</span>
          </button>
        )}
      </div>
    </header>
  );
}
