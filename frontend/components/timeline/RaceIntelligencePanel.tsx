"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import type { RaceIntelligence } from "@/lib/raceIntelligence";
import { RaceEventFeed } from "@/components/timeline/RaceEventFeed";
import { PositionHistoryChart } from "@/components/timeline/PositionHistoryChart";
import { BookmarksPanel } from "@/components/timeline/BookmarksPanel";
import { Button } from "@/components/ui/button";
import { exportJSON } from "@/lib/exportUtils";
import { toast } from "@/store/toastStore";

interface RaceIntelligencePanelProps {
  race: SelectedRace | null;
  intelligence: RaceIntelligence | null;
  isLoading: boolean;
  onSeek: (t: number) => void;
}

export function RaceIntelligencePanel({ race, intelligence, isLoading, onSeek }: RaceIntelligencePanelProps) {
  const seek = useReplayStore((s) => s.seek);
  const [expanded, setExpanded] = useState(false);

  // Combined seek: immediate local UI feedback + mirror to the WebSocket for playback sync.
  const handleSeek = (t: number) => {
    seek(t);
    onSeek(t);
  };

  const handleExportEvents = () => {
    if (!intelligence) return;
    exportJSON(
      { overtakes: intelligence.overtakes, fastestLaps: intelligence.fastestLaps },
      `${race?.event ?? "race"}-events.json`
    );
    toast.success("Exported race events as JSON");
  };

  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted hover:text-white"
          aria-expanded={expanded}
          aria-controls="race-intelligence-content"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          Race Intelligence
          {isLoading && <span className="text-[10px] font-normal normal-case text-muted">analyzing…</span>}
        </button>

        {expanded && intelligence && (
          <Button
            size="icon" variant="outline" onClick={handleExportEvents}
            title="Export race events as JSON" aria-label="Export race events as JSON"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="race-intelligence-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">Event Feed</p>
                <RaceEventFeed intelligence={intelligence} onSeek={handleSeek} />
              </div>
              <div>
                <PositionHistoryChart intelligence={intelligence} />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">Bookmarks</p>
                <BookmarksPanel race={race} onSeek={handleSeek} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
