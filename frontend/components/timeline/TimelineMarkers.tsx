"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, Sparkles } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { RaceIntelligence } from "@/lib/raceIntelligence";

interface Marker {
  id: string;
  timestamp: number;
  kind: "overtake" | "fastest-lap";
  tooltip: string;
  driver: string;
}

interface TimelineMarkersProps {
  intelligence: RaceIntelligence | null;
  onSeek: (t: number) => void;
}

export function TimelineMarkers({ intelligence, onSeek }: TimelineMarkersProps) {
  const metadata = useReplayStore((s) => s.metadata);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const duration = metadata?.duration ?? 0;

  const markers = useMemo<Marker[]>(() => {
    if (!intelligence) return [];
    return [
      ...intelligence.overtakes.map((e): Marker => ({
        id: e.id, timestamp: e.timestamp, kind: "overtake",
        tooltip: `${e.gainedBy} overtakes ${e.lostBy} — Lap ${e.lap}`, driver: e.gainedBy,
      })),
      ...intelligence.fastestLaps.map((e): Marker => ({
        id: e.id, timestamp: e.timestamp, kind: "fastest-lap",
        tooltip: `Fastest lap — ${e.driver}, Lap ${e.lap}`, driver: e.driver,
      })),
    ];
  }, [intelligence]);

  if (!intelligence || duration <= 0 || markers.length === 0) return null;

  const handleClick = (marker: Marker) => {
    onSeek(marker.timestamp);
    setSelectedDriver(marker.driver);
  };

  return (
    <div className="relative h-4 w-full px-4">
      {markers.map((marker) => (
        <motion.button
          key={marker.id}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.5 }}
          className="absolute top-0 -translate-x-1/2"
          style={{ left: `${Math.min(100, Math.max(0, (marker.timestamp / duration) * 100))}%` }}
          onClick={() => handleClick(marker)}
          onMouseEnter={() => setHoveredId(marker.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {marker.kind === "overtake" ? (
            <ArrowRightLeft className="h-3 w-3 text-cyan-400" />
          ) : (
            <Sparkles className="h-3 w-3 text-purple-400" />
          )}
          {hoveredId === marker.id && (
            <span className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-1.5 py-0.5 text-[9px] text-white">
              {marker.tooltip}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
