"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Swords, TrendingUp, CircleDot, Zap, Flag, Route, Info } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { Insight, InsightCategory } from "@/lib/raceInsights";
import { cn } from "@/lib/utils";

// Overtakes and fastest-laps already get markers on the main replay timeline
// (components/timeline/TimelineMarkers.tsx) — shown there, not duplicated here.
const ICONS: Partial<Record<InsightCategory, React.ComponentType<{ className?: string }>>> = {
  battle: Swords, pace: TrendingUp, consistency: TrendingUp, tyres: CircleDot,
  drs: Zap, position: Flag, strategy: Route, general: Info,
};

interface InsightTimelineProps {
  insights: Insight[];
  onSelect: (insight: Insight) => void;
}

export function InsightTimeline({ insights, onSelect }: InsightTimelineProps) {
  const duration = useReplayStore((s) => s.metadata?.duration ?? 0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const markers = useMemo(
    () => insights.filter((i) => i.category !== "overtake" && i.category !== "speed" && i.timestamp > 0),
    [insights]
  );

  if (duration <= 0 || markers.length === 0) return null;

  return (
    <div className="relative h-4 w-full" role="list" aria-label="Insight timeline markers">
      {markers.map((m) => {
        const Icon = ICONS[m.category] ?? Info;
        return (
          <motion.button
            key={m.id}
            role="listitem"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.5 }}
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${Math.min(100, Math.max(0, (m.timestamp / duration) * 100))}%` }}
            onClick={() => onSelect(m)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
            aria-label={m.title}
          >
            <Icon className={cn("h-3 w-3", m.severity === "high" ? "text-accent" : "text-cyan-400")} />
            {hoveredId === m.id && (
              <span className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-1.5 py-0.5 text-[9px] text-white">
                {m.title}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
