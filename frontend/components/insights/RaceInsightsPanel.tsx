"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Search, FileJson, FileText, Table2 } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import { useRaceInsights } from "@/hooks/useRaceInsights";
import type { RaceIntelligence } from "@/lib/raceIntelligence";
import type { Insight, InsightCategory, InsightSeverity } from "@/lib/raceInsights";
import { InsightCard } from "@/components/insights/InsightCard";
import { InsightSummary } from "@/components/insights/InsightSummary";
import { InsightTimeline } from "@/components/insights/InsightTimeline";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePreferences } from "@/hooks/usePreferences";
import { exportJSON, exportCSV, exportMarkdown } from "@/lib/exportUtils";
import { toast } from "@/store/toastStore";
import { cn } from "@/lib/utils";

const CATEGORIES: InsightCategory[] = [
  "overtake", "battle", "pace", "tyres", "consistency", "speed", "drs", "position", "strategy", "general",
];
const SEVERITIES: InsightSeverity[] = ["high", "medium", "low"];

interface RaceInsightsPanelProps {
  race: SelectedRace | null;
  intelligence: RaceIntelligence | null;
  onSeek: (t: number) => void;
}

export function RaceInsightsPanel({ race, intelligence, onSeek }: RaceInsightsPanelProps) {
  const seek = useReplayStore((s) => s.seek);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);
  const metadata = useReplayStore((s) => s.metadata);
  const { preferences } = usePreferences();
  const compact = preferences.compactMode;

  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<InsightCategory>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<InsightSeverity | "all">("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [lapFilter, setLapFilter] = useState<string>("");

  const { insights, summary, isLoading } = useRaceInsights(race, intelligence);

  const handleSelect = (insight: Insight) => {
    seek(insight.timestamp);
    onSeek(insight.timestamp);
    if (insight.drivers[0]) setSelectedDriver(insight.drivers[0]);
  };

  const toggleCategory = (cat: InsightCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const lapNum = lapFilter.trim() === "" ? null : Number(lapFilter);
    return insights.filter((i) => {
      if (activeCategories.size > 0 && !activeCategories.has(i.category)) return false;
      if (severityFilter !== "all" && i.severity !== severityFilter) return false;
      if (driverFilter !== "all" && !i.drivers.includes(driverFilter)) return false;
      if (lapNum !== null && !Number.isNaN(lapNum) && i.lap !== lapNum) return false;
      if (query.trim() && !`${i.title} ${i.description}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [insights, activeCategories, severityFilter, driverFilter, lapFilter, query]);

  const handleExportJSON = () => {
    exportJSON(insights, `${race?.event ?? "race"}-insights.json`);
    toast.success("Exported insights as JSON");
  };

  const handleExportCSV = () => {
    exportCSV(
      insights.map((i) => ({
        title: i.title, description: i.description, timestampSeconds: i.timestamp,
        lap: i.lap, drivers: i.drivers.join("; "), category: i.category, severity: i.severity,
      })),
      `${race?.event ?? "race"}-insights.csv`
    );
    toast.success("Exported insights as CSV");
  };

  const handleExportMarkdown = () => {
    const lines = [`# Race Insights — ${race?.event ?? ""} ${race?.year ?? ""}`, ""];
    if (summary) {
      lines.push("## Session Summary", "");
      if (summary.winner) lines.push(`- **Winner (so far):** ${summary.winner}`);
      if (summary.biggestGain) lines.push(`- **Biggest gain:** ${summary.biggestGain.driver} (+${summary.biggestGain.places})`);
      if (summary.fastestLap) lines.push(`- **Fastest lap:** ${summary.fastestLap.driver}, Lap ${summary.fastestLap.lap}`);
      lines.push(`- **Overtakes detected:** ${summary.totalOvertakes}`, `- **Drivers compared:** ${summary.driversCompared}`, "");
    }
    lines.push("## Insights", "");
    insights.forEach((i) => lines.push(`- **[${i.category}] ${i.title}** (Lap ${i.lap}) — ${i.description}`));
    exportMarkdown(lines.join("\n"), `${race?.event ?? "race"}-insights.md`);
    toast.success("Exported insights as Markdown");
  };

  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted hover:text-white"
          aria-expanded={expanded}
          aria-controls="race-insights-content"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          AI Race Insights
          {isLoading && <span className="text-[10px] font-normal normal-case text-muted">analyzing…</span>}
        </button>

        {expanded && insights.length > 0 && (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={handleExportJSON} title="Export as JSON" aria-label="Export insights as JSON">
              <FileJson className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleExportMarkdown} title="Export as Markdown" aria-label="Export insights as Markdown">
              <FileText className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleExportCSV} title="Export as CSV" aria-label="Export insights as CSV">
              <Table2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="race-insights-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-col gap-3">
              <InsightSummary summary={summary} />

              <InsightTimeline insights={insights} onSelect={handleSelect} />

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-[160px] flex-1 items-center gap-1.5 rounded-md border border-border bg-black/30 px-2">
                  <Search className="h-3.5 w-3.5 text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search insights…"
                    aria-label="Search insights"
                    className="h-8 w-full bg-transparent text-xs text-white outline-none placeholder:text-muted"
                  />
                </div>

                <Select value={driverFilter} onValueChange={setDriverFilter}>
                  <SelectTrigger className="h-8 w-32 text-xs" aria-label="Filter by driver">
                    <SelectValue placeholder="Driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All drivers</SelectItem>
                    {metadata?.drivers.map((d) => (
                      <SelectItem key={d.abbreviation} value={d.abbreviation}>{d.abbreviation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as InsightSeverity | "all")}>
                  <SelectTrigger className="h-8 w-28 text-xs" aria-label="Filter by severity">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severities</SelectItem>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <input
                  value={lapFilter}
                  onChange={(e) => setLapFilter(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Lap #"
                  aria-label="Filter by lap number"
                  className="h-8 w-16 rounded-md border border-border bg-black/30 px-2 text-xs text-white placeholder:text-muted"
                />
              </div>

              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    aria-pressed={activeCategories.has(cat)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize transition-colors",
                      activeCategories.has(cat)
                        ? "border-accent bg-accent/20 text-white"
                        : "border-border bg-black/20 text-muted hover:text-white"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className={cn("flex flex-col gap-1.5 overflow-y-auto", compact ? "max-h-56" : "max-h-96")}>
                {filtered.length === 0 && (
                  <p className="text-xs text-muted">
                    {isLoading ? "Analyzing race data…" : "No insights match the current filters."}
                  </p>
                )}
                <AnimatePresence initial={false}>
                  {filtered.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} onSelect={handleSelect} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
