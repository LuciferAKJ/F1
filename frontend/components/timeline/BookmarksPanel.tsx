"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark as BookmarkIcon, Trash2, Plus, Download } from "lucide-react";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import { Button } from "@/components/ui/button";
import { exportJSON } from "@/lib/exportUtils";
import { toast } from "@/store/toastStore";

interface BookmarksPanelProps {
  race: SelectedRace | null;
  onSeek: (t: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function BookmarksPanel({ race, onSeek }: BookmarksPanelProps) {
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);
  const { bookmarks, addBookmark, removeBookmark } = useBookmarks(race);
  const [labelDraft, setLabelDraft] = useState("");

  const handleAdd = () => {
    const label = labelDraft.trim() || `Bookmark @ ${formatTime(currentTimestamp)}`;
    addBookmark(currentTimestamp, label);
    setLabelDraft("");
    toast.success(`Bookmarked "${label}"`);
  };

  const handleExport = () => {
    exportJSON(bookmarks, `${race?.event ?? "race"}-bookmarks.json`);
    toast.success("Exported bookmarks as JSON");
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <input
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder={`Name this moment (${formatTime(currentTimestamp)})`}
          aria-label="Bookmark name"
          className="h-8 flex-1 rounded-md border border-border bg-black/30 px-2 text-xs text-white placeholder:text-muted"
        />
        <Button size="sm" onClick={handleAdd} title="Bookmark current timestamp">
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
        <Button
          size="icon" variant="outline" onClick={handleExport}
          disabled={bookmarks.length === 0} title="Export bookmarks as JSON"
          aria-label="Export bookmarks as JSON"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {bookmarks.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-between gap-2 rounded-md bg-black/30 px-2 py-1.5 text-xs"
            >
              <button
                onClick={() => onSeek(b.timestamp)}
                className="flex flex-1 items-center gap-1.5 truncate text-left hover:text-accent"
              >
                <BookmarkIcon className="h-3 w-3 shrink-0 text-accent" />
                <span className="truncate">{b.label}</span>
                <span className="shrink-0 text-muted">· {formatTime(b.timestamp)}</span>
              </button>
              <button
                onClick={() => removeBookmark(b.id)}
                className="shrink-0 text-muted hover:text-red-400"
                title="Delete bookmark"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {bookmarks.length === 0 && <p className="text-xs text-muted">No bookmarks yet.</p>}
      </div>
    </div>
  );
}
