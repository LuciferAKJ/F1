"use client";

import { motion } from "framer-motion";
import {
  ArrowRightLeft, Swords, TrendingUp, CircleDot, Gauge, Zap, Flag, Route, Info,
} from "lucide-react";
import type { Insight, InsightCategory, InsightSeverity } from "@/lib/raceInsights";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<InsightCategory, React.ComponentType<{ className?: string }>> = {
  overtake: ArrowRightLeft, battle: Swords, pace: TrendingUp, tyres: CircleDot,
  consistency: TrendingUp, speed: Gauge, drs: Zap, position: Flag, strategy: Route, general: Info,
};

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
  high: "border-accent/50 bg-accent/10",
  medium: "border-amber-500/40 bg-amber-500/5",
  low: "border-border bg-black/20",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface InsightCardProps {
  insight: Insight;
  onSelect: (insight: Insight) => void;
}

export function InsightCard({ insight, onSelect }: InsightCardProps) {
  const Icon = CATEGORY_ICON[insight.category];

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onClick={() => onSelect(insight)}
      className={cn(
        "flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors hover:brightness-125",
        SEVERITY_STYLES[insight.severity]
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
        <span className="flex-1 truncate text-xs font-bold text-white">{insight.title}</span>
        {insight.lap > 0 && <span className="shrink-0 text-[10px] text-muted">Lap {insight.lap}</span>}
        {insight.timestamp > 0 && <span className="shrink-0 text-[10px] text-muted">{formatTime(insight.timestamp)}</span>}
      </div>
      <p className="pl-5 text-[11px] leading-snug text-muted">{insight.description}</p>
    </motion.button>
  );
}
