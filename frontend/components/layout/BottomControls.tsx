"use client";

import { useEffect } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/store/toastStore";

function formatRaceTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

const SPEEDS = [1, 2, 4];

interface BottomControlsProps {
  onSeek: (timestamp: number) => void;
}

export function BottomControls({ onSeek }: BottomControlsProps) {
  const playing = useReplayStore((s) => s.playing);
  const togglePlay = useReplayStore((s) => s.togglePlay);
  const pause = useReplayStore((s) => s.pause);
  const seek = useReplayStore((s) => s.seek);
  const playbackSpeed = useReplayStore((s) => s.playbackSpeed);
  const setSpeed = useReplayStore((s) => s.setSpeed);
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);
  const metadata = useReplayStore((s) => s.metadata);
  const reset = useReplayStore((s) => s.reset);
  const selectedRace = useReplayStore((s) => s.selectedRace);
  const setSelectedRace = useReplayStore((s) => s.setSelectedRace);

  const duration = metadata?.duration ?? 0;

  const handleReset = () => {
    pause();
    seek(0);
    onSeek(0);
  };

  const handleScrub = (value: number[]) => {
    const t = value[0];
    seek(t);
    onSeek(t);
  };

  const handleHardReset = () => {
    // Fully reset replay state but keep the race selected (clears stale frames).
    reset();
    if (selectedRace) setSelectedRace(selectedRace);
    toast.info("Replay state cleared");
  };

  // Space to play/pause, arrow keys to seek ±5s — ignored while typing in an input/textarea
  // or while the command palette (or any other dialog) is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping || e.metaKey || e.ctrlKey) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        const t = Math.max(0, currentTimestamp - 5);
        seek(t);
        onSeek(t);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        const t = Math.min(duration, currentTimestamp + 5);
        seek(t);
        onSeek(t);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, seek, onSeek, currentTimestamp, duration]);

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-panel px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="w-16 text-xs text-muted" aria-hidden="true">{formatRaceTime(currentTimestamp)}</span>
        <Slider
          min={0}
          max={Math.max(duration, 1)}
          step={0.5}
          value={[currentTimestamp]}
          onValueChange={handleScrub}
          className="flex-1"
          aria-label="Replay timeline scrubber"
          aria-valuetext={`${formatRaceTime(currentTimestamp)} of ${formatRaceTime(duration)}`}
        />
        <span className="w-16 text-right text-xs text-muted" aria-hidden="true">{formatRaceTime(duration)}</span>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button size="icon" variant="outline" onClick={handleReset} title="Reset to start (R)" aria-label="Reset replay to start">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon" onClick={togglePlay}
          title={playing ? "Pause (Space)" : "Play (Space)"}
          aria-label={playing ? "Pause replay" : "Play replay"}
          aria-pressed={playing}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <div className="ml-4 flex gap-1" role="group" aria-label="Playback speed">
          {SPEEDS.map((sp) => (
            <Button
              key={sp}
              size="sm"
              variant={playbackSpeed === sp ? "default" : "outline"}
              onClick={() => setSpeed(sp)}
              aria-pressed={playbackSpeed === sp}
            >
              {sp}x
            </Button>
          ))}
        </div>

        <Button size="sm" variant="ghost" className="ml-4 text-muted" onClick={handleHardReset}>
          Clear session state
        </Button>
      </div>
    </div>
  );
}
