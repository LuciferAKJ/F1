"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  Sparkles,
  Clock,
  Trash2,
} from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import { toast } from "@/store/toastStore";
import { cn } from "@/lib/utils";
import type { RaceIntelligence } from "@/lib/raceIntelligence";

/**
 * Format seconds into F1 standard telemetry time format (HH:MM:SS.mmm or MM:SS.mmm).
 * Tabular numerals ensure jitter-free display during 60 FPS playback.
 */
function formatRaceTime(seconds: number, includeMs = false): string {
  const safeSec = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const h = Math.floor(safeSec / 3600);
  const m = Math.floor((safeSec % 3600) / 60);
  const s = Math.floor(safeSec % 60);
  const ms = Math.floor((safeSec % 1) * 1000);

  const parts = [
    h > 0 ? String(h).padStart(2, "0") : null,
    String(m).padStart(2, "0"),
    String(s).padStart(2, "0"),
  ].filter(Boolean);

  const base = parts.join(":");
  if (includeMs) {
    return `${base}.${String(ms).padStart(3, "0")}`;
  }
  return base;
}

const SUPPORTED_SPEEDS = [1, 2, 4];

interface MarkerItem {
  id: string;
  timestamp: number;
  kind: "overtake" | "fastest-lap";
  tooltip: string;
  driver: string;
  lap: number;
}

interface BottomControlsProps {
  onSeek: (timestamp: number) => void;
  intelligence?: RaceIntelligence | null;
}

export function BottomControls({ onSeek, intelligence }: BottomControlsProps) {
  const playing = useReplayStore((s) => s.playing);
  const togglePlay = useReplayStore((s) => s.togglePlay);
  const pause = useReplayStore((s) => s.pause);
  const play = useReplayStore((s) => s.play);
  const seek = useReplayStore((s) => s.seek);
  const playbackSpeed = useReplayStore((s) => s.playbackSpeed);
  const setSpeed = useReplayStore((s) => s.setSpeed);
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);
  const currentLap = useReplayStore((s) => s.currentLap);
  const currentFrame = useReplayStore((s) => s.currentFrame);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);
  const metadata = useReplayStore((s) => s.metadata);
  const reset = useReplayStore((s) => s.reset);
  const selectedRace = useReplayStore((s) => s.selectedRace);
  const setSelectedRace = useReplayStore((s) => s.setSelectedRace);

  const duration = metadata?.duration ?? 0;
  const totalLaps = metadata?.totalLaps ?? null;
  const frameInterval = metadata?.frameInterval ?? 0.5;
  const frameRateHz = frameInterval > 0 ? (1 / frameInterval).toFixed(1).replace(/\.0$/, "") : "2";

  // Active sector from current frame (selected driver, or leader P1)
  const activeSector = useMemo(() => {
    if (!currentFrame?.drivers?.length) return null;
    if (selectedDriver) {
      const d = currentFrame.drivers.find((dr) => dr.driverId === selectedDriver);
      if (d) return d.sector;
    }
    const leader = currentFrame.drivers.find((dr) => dr.position === 1);
    return leader?.sector ?? currentFrame.drivers[0]?.sector ?? null;
  }, [currentFrame, selectedDriver]);

  // Derived real race intelligence markers (Zero fabricated data)
  const markers = useMemo<MarkerItem[]>(() => {
    if (!intelligence) return [];
    const items: MarkerItem[] = [];

    intelligence.overtakes.forEach((e) => {
      items.push({
        id: `ot-${e.id}`,
        timestamp: e.timestamp,
        kind: "overtake",
        tooltip: `P${e.resultingPosition} · ${e.gainedBy} passed ${e.lostBy} (Lap ${e.lap})`,
        driver: e.gainedBy,
        lap: e.lap,
      });
    });

    intelligence.fastestLaps.forEach((e) => {
      items.push({
        id: `fl-${e.id}`,
        timestamp: e.timestamp,
        kind: "fastest-lap",
        tooltip: `FASTEST LAP (EST.) · ${e.driver} (${e.lapTime.toFixed(3)}s, Lap ${e.lap})`,
        driver: e.driver,
        lap: e.lap,
      });
    });

    return items;
  }, [intelligence]);

  // Static lap tick positions along timeline
  const lapTicks = useMemo(() => {
    if (!totalLaps || totalLaps <= 1 || duration <= 0) return [];
    const ticks: { lap: number; percent: number }[] = [];
    for (let lap = 1; lap <= totalLaps; lap++) {
      ticks.push({
        lap,
        percent: ((lap - 1) / totalLaps) * 100,
      });
    }
    return ticks;
  }, [totalLaps, duration]);

  // Scrubber drag & interaction state
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<{ xPercent: number; time: number } | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<MarkerItem | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const calculateTimestampFromEvent = useCallback(
    (clientX: number): number => {
      if (!trackRef.current || duration <= 0) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const relativeX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = relativeX / rect.width;
      return Math.round((ratio * duration) / frameInterval) * frameInterval;
    },
    [duration, frameInterval]
  );

  const performSeek = useCallback(
    (targetTime: number) => {
      const clamped = Math.max(0, Math.min(duration, targetTime));
      seek(clamped);
      onSeek(clamped);
    },
    [duration, seek, onSeek]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const target = calculateTimestampFromEvent(e.clientX);
    performSeek(target);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current || duration <= 0) return;
    const target = calculateTimestampFromEvent(e.clientX);
    const rect = trackRef.current.getBoundingClientRect();
    const xPercent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));

    setHoverPosition({ xPercent, time: target });

    if (isDragging) {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        performSeek(target);
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
      const target = calculateTimestampFromEvent(e.clientX);
      performSeek(target);
    }
  };

  const handlePointerLeave = () => {
    if (!isDragging) {
      setHoverPosition(null);
    }
  };

  // Step Frame Backward
  const handleStepBack = useCallback(() => {
    pause();
    const target = Math.max(0, currentTimestamp - frameInterval);
    performSeek(target);
  }, [pause, currentTimestamp, frameInterval, performSeek]);

  // Step Frame Forward
  const handleStepForward = useCallback(() => {
    pause();
    const target = Math.min(duration, currentTimestamp + frameInterval);
    performSeek(target);
  }, [pause, duration, currentTimestamp, frameInterval, performSeek]);

  // Reset to Start
  const handleRestart = useCallback(() => {
    pause();
    performSeek(0);
  }, [pause, performSeek]);

  // Hard Reset Session Cache
  const handleHardReset = useCallback(() => {
    reset();
    if (selectedRace) setSelectedRace(selectedRace);
    toast.info("Replay session buffer reset");
  }, [reset, selectedRace, setSelectedRace]);

  // Keyboard Shortcuts (Space, ArrowLeft, ArrowRight, R, [, ])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping || e.metaKey || e.ctrlKey) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 5;
        performSeek(Math.max(0, currentTimestamp - delta));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 5;
        performSeek(Math.min(duration, currentTimestamp + delta));
      } else if (e.code === "KeyR" && !e.altKey) {
        e.preventDefault();
        handleRestart();
      } else if (e.code === "BracketLeft" || e.code === "Comma") {
        e.preventDefault();
        handleStepBack();
      } else if (e.code === "BracketRight" || e.code === "Period") {
        e.preventDefault();
        handleStepForward();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, currentTimestamp, duration, performSeek, handleRestart, handleStepBack, handleStepForward]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTimestamp / duration) * 100)) : 0;

  return (
    <div className="flex flex-col shrink-0 bg-pitwall-dock border-t border-pitwall-hairline px-3 py-2 select-none z-20">
      {/* =========================================================================
          TIER A: RACE EVENT RAIL & LAP TICKS
         ========================================================================= */}
      <div className="relative h-4 w-full px-2 mb-0.5">
        {/* Lap boundary tick markers */}
        {lapTicks.map((t) => (
          <div
            key={t.lap}
            className="absolute top-1 bottom-0 w-px bg-pitwall-hairline/60 pointer-events-none"
            style={{ left: `${t.percent}%` }}
            title={`Lap ${t.lap}`}
          />
        ))}

        {/* Real race event chips (Overtakes & Fastest Laps) */}
        {markers.map((m) => {
          const leftPercent = duration > 0 ? (m.timestamp / duration) * 100 : 0;
          const isOvertake = m.kind === "overtake";

          return (
            <button
              key={m.id}
              onClick={(e) => {
                e.stopPropagation();
                performSeek(m.timestamp);
                setSelectedDriver(m.driver);
              }}
              onMouseEnter={() => setHoveredMarker(m)}
              onMouseLeave={() => setHoveredMarker(null)}
              className="absolute top-0 -translate-x-1/2 p-0.5 rounded hover:scale-125 transition-transform z-10 focus:outline-none"
              style={{ left: `${leftPercent}%` }}
              title={m.tooltip}
              aria-label={m.tooltip}
            >
              {isOvertake ? (
                <span className="flex h-3 w-3 items-center justify-center rounded-xs bg-pitwall-telemetry/20 border border-pitwall-telemetry text-pitwall-telemetry">
                  <ArrowRightLeft className="h-2 w-2" />
                </span>
              ) : (
                <span className="flex h-3 w-3 items-center justify-center rounded-xs bg-pitwall-sector/20 border border-pitwall-sector text-pitwall-sector">
                  <Sparkles className="h-2 w-2" />
                </span>
              )}
            </button>
          );
        })}

        {/* Event Marker Hover Tooltip */}
        {hoveredMarker && (
          <div
            className="absolute -top-7 -translate-x-1/2 rounded bg-pitwall-elevated px-2 py-0.5 font-mono text-[9px] font-bold text-pitwall-text border border-pitwall-hairline shadow-lg pointer-events-none z-30 whitespace-nowrap"
            style={{ left: `${(hoveredMarker.timestamp / Math.max(1, duration)) * 100}%` }}
          >
            {hoveredMarker.tooltip}
          </div>
        )}
      </div>

      {/* =========================================================================
          TIER B: PLAYBACK PROGRESS SCRUBBER TRACK & PLAYHEAD
         ========================================================================= */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Replay timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={Math.max(duration, 1)}
        aria-valuenow={currentTimestamp}
        aria-valuetext={`${formatRaceTime(currentTimestamp, true)} of ${formatRaceTime(duration)}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            performSeek(Math.max(0, currentTimestamp - 5));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            performSeek(Math.min(duration, currentTimestamp + 5));
          } else if (e.key === "Home") {
            e.preventDefault();
            performSeek(0);
          } else if (e.key === "End") {
            e.preventDefault();
            performSeek(duration);
          }
        }}
        className="relative w-full h-3 cursor-pointer flex items-center group touch-none focus:outline-none"
      >
        {/* Background track */}
        <div className="w-full h-2 bg-pitwall-canvas rounded-full overflow-hidden border border-pitwall-hairline/80 relative">
          {/* Elapsed Progress Fill */}
          <div
            className="h-full bg-pitwall-telemetry rounded-full transition-all duration-75 relative"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Hover preview marker */}
        {hoverPosition && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-pitwall-text-muted/60 pointer-events-none"
            style={{ left: `${hoverPosition.xPercent}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-pitwall-canvas px-1.5 py-0.5 font-mono text-[9px] text-pitwall-text border border-pitwall-hairline whitespace-nowrap">
              {formatRaceTime(hoverPosition.time, true)}
            </div>
          </div>
        )}

        {/* Playhead thumb (Racing Red Pin) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-pitwall-signal ring-2 ring-pitwall-signal/30 shadow-[0_0_8px_rgba(225,6,0,0.4)] flex items-center justify-center pointer-events-none transition-transform group-hover:scale-110"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-pitwall-signal" />
        </div>
      </div>

      {/* =========================================================================
          TRANSPORT CONTROLS ROW
         ========================================================================= */}
      <div className="flex items-center justify-between gap-3 mt-1.5 flex-wrap md:flex-nowrap">
        {/* Left: Transport Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Reset to Start */}
          <button
            onClick={handleRestart}
            title="Restart replay to start (R)"
            aria-label="Restart replay to start"
            className="h-7 w-7 rounded bg-pitwall-surface hover:bg-pitwall-elevated text-pitwall-text-muted hover:text-white flex items-center justify-center border border-pitwall-hairline transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Step Back 1 Frame */}
          <button
            onClick={handleStepBack}
            title="Step back 1 frame (,)"
            aria-label="Step back 1 frame"
            className="h-7 w-7 rounded bg-pitwall-surface hover:bg-pitwall-elevated text-pitwall-text-muted hover:text-white flex items-center justify-center border border-pitwall-hairline transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            onClick={togglePlay}
            title={playing ? "Pause replay (Space)" : "Play replay (Space)"}
            aria-label={playing ? "Pause replay" : "Play replay"}
            aria-pressed={playing}
            className="h-7 px-3.5 rounded bg-pitwall-signal hover:bg-pitwall-signal/90 text-white font-display font-bold uppercase tracking-wider text-xs flex items-center gap-1.5 shadow-[0_0_10px_rgba(225,6,0,0.3)] transition-all"
          >
            {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>{playing ? "PAUSE" : "PLAY"}</span>
          </button>

          {/* Step Forward 1 Frame */}
          <button
            onClick={handleStepForward}
            title="Step forward 1 frame (.)"
            aria-label="Step forward 1 frame"
            className="h-7 w-7 rounded bg-pitwall-surface hover:bg-pitwall-elevated text-pitwall-text-muted hover:text-white flex items-center justify-center border border-pitwall-hairline transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          {/* Speed Selector (1x, 2x, 4x) */}
          <div
            className="flex items-center rounded bg-pitwall-surface p-0.5 border border-pitwall-hairline ml-1"
            role="group"
            aria-label="Playback speed"
          >
            {SUPPORTED_SPEEDS.map((sp) => (
              <button
                key={sp}
                onClick={() => setSpeed(sp)}
                aria-pressed={playbackSpeed === sp}
                className={cn(
                  "px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase transition-colors",
                  playbackSpeed === sp
                    ? "bg-pitwall-elevated text-pitwall-telemetry border border-pitwall-telemetry/40 shadow-xs"
                    : "text-pitwall-text-muted hover:text-white"
                )}
              >
                {sp}x
              </button>
            ))}
          </div>
        </div>

        {/* Center: Session Metas (Lap, Sector, Elapsed, Duration) */}
        <div className="flex items-center gap-3 font-mono text-xs">
          {/* Lap Status */}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pitwall-drs animate-pulse" />
            <span className="font-bold text-pitwall-drs">
              LAP {currentLap}
              {totalLaps ? ` / ${totalLaps}` : ""}
            </span>
          </div>

          {/* Active Sector Pill */}
          {activeSector && (
            <div className="flex items-center gap-1 rounded bg-pitwall-surface px-1.5 py-0.5 text-[10px] font-bold border border-pitwall-hairline text-pitwall-warning">
              <span>S{activeSector}</span>
            </div>
          )}

          {/* Precise Tabular Timestamps */}
          <div className="flex items-baseline gap-1 font-telemetry tabular-nums">
            <span className="font-bold text-pitwall-text text-sm">
              {formatRaceTime(currentTimestamp, true)}
            </span>
            <span className="text-pitwall-text-muted text-xs">
              / {formatRaceTime(duration, false)}
            </span>
          </div>
        </div>

        {/* Right: Technical Source Metadata & Buffer Controls */}
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {/* Data rate indicator (Accurate FastF1 source rate) */}
          <div
            className="hidden sm:flex items-center gap-1 rounded bg-pitwall-surface px-2 py-0.5 border border-pitwall-hairline text-pitwall-text-muted"
            title={`Telemetry stream sampling interval: ${frameInterval}s (${frameRateHz} Hz)`}
          >
            <Clock className="h-3 w-3 text-pitwall-telemetry" />
            <span>{frameRateHz} Hz</span>
            <span className="text-pitwall-hairline">·</span>
            <span>{frameInterval}s FRAME</span>
          </div>

          {/* Reset Session Cache Action */}
          <button
            onClick={handleHardReset}
            className="flex items-center gap-1 rounded px-2 py-0.5 bg-pitwall-surface hover:bg-pitwall-elevated text-pitwall-text-muted hover:text-white border border-pitwall-hairline transition-colors uppercase text-[9px] font-bold"
            title="Clear and reset local session frame buffer"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden md:inline">RESET BUFFER</span>
          </button>
        </div>
      </div>
    </div>
  );
}
