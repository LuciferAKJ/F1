"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRightLeft, Sparkles } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { RaceIntelligence } from "@/lib/raceIntelligence";

interface FeedItem {
  id: string;
  timestamp: number;
  lap: number;
  kind: "overtake" | "fastest-lap";
  description: string;
  focusDriver: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

interface RaceEventFeedProps {
  intelligence: RaceIntelligence | null;
  onSeek: (t: number) => void;
}

export function RaceEventFeed({ intelligence, onSeek }: RaceEventFeedProps) {
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);

  const allItems = useMemo<FeedItem[]>(() => {
    if (!intelligence) return [];
    const overtakeItems: FeedItem[] = intelligence.overtakes.map((e) => ({
      id: e.id, timestamp: e.timestamp, lap: e.lap, kind: "overtake",
      description: `${e.gainedBy} passes ${e.lostBy} for P${e.resultingPosition}`,
      focusDriver: e.gainedBy,
    }));
    const fastestLapItems: FeedItem[] = intelligence.fastestLaps.map((e) => ({
      id: e.id, timestamp: e.timestamp, lap: e.lap, kind: "fastest-lap",
      description: `New fastest lap — ${e.driver}: ${formatLapTime(e.lapTime)} (Lap ${e.lap})`,
      focusDriver: e.driver,
    }));
    return [...overtakeItems, ...fastestLapItems].sort((a, b) => a.timestamp - b.timestamp);
  }, [intelligence]);

  // Reveal events as replay time passes them, newest first — mirrors a live broadcast feed.
  const visibleItems = useMemo(
    () => allItems.filter((item) => item.timestamp <= currentTimestamp).slice().reverse(),
    [allItems, currentTimestamp]
  );

  const handleClick = (item: FeedItem) => {
    onSeek(item.timestamp);
    setSelectedDriver(item.focusDriver); // reuses the existing selected-driver glow/telemetry focus
  };

  if (!intelligence) {
    return <p className="text-xs text-muted">Analyzing race data…</p>;
  }

  return (
    <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
      {visibleItems.length === 0 && <p className="text-xs text-muted">No events yet — play the replay.</p>}
      <AnimatePresence initial={false}>
        {visibleItems.map((item) => (
          <motion.button
            key={item.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={() => handleClick(item)}
            className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1.5 text-left text-xs hover:bg-black/50"
          >
            {item.kind === "overtake" ? (
              <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-400" />
            )}
            <span className="flex-1 truncate">{item.description}</span>
            <span className="shrink-0 text-muted">{formatTime(item.timestamp)}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
