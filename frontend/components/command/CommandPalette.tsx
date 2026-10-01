"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Play, Pause, RotateCcw, Users, LayoutGrid, Bookmark as BookmarkIcon, Search,
} from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import { usePreferences } from "@/hooks/usePreferences";
import { useBookmarks } from "@/hooks/useBookmarks";
import { toast } from "@/store/toastStore";

interface Command {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedRace = useReplayStore((s) => s.selectedRace);
  const metadata = useReplayStore((s) => s.metadata);
  const playing = useReplayStore((s) => s.playing);
  const togglePlay = useReplayStore((s) => s.togglePlay);
  const pause = useReplayStore((s) => s.pause);
  const seek = useReplayStore((s) => s.seek);
  const setSelectedDriver = useReplayStore((s) => s.setSelectedDriver);
  const wsControls = useReplayStore((s) => s.wsControls);
  const { preferences, setPreference } = usePreferences();
  const { bookmarks } = useBookmarks(selectedRace);

  const combinedSeek = (t: number) => {
    seek(t);
    wsControls?.seek(t);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: "play-pause", label: playing ? "Pause replay" : "Play replay", icon: playing ? Pause : Play,
        run: () => togglePlay(),
      },
      {
        id: "restart", label: "Restart replay", icon: RotateCcw,
        run: () => { pause(); combinedSeek(0); },
      },
      {
        id: "compact", label: preferences.compactMode ? "Disable compact mode" : "Enable compact mode", icon: LayoutGrid,
        run: () => setPreference("compactMode", !preferences.compactMode),
      },
      {
        id: "comparison", label: preferences.comparisonMode ? "Disable comparison mode" : "Enable comparison mode", icon: Users,
        run: () => setPreference("comparisonMode", !preferences.comparisonMode),
      },
    ];

    metadata?.drivers.forEach((d) => {
      list.push({
        id: `driver-${d.abbreviation}`, label: `Select driver: ${d.abbreviation} (${d.teamName})`, icon: Users,
        run: () => { setSelectedDriver(d.abbreviation); setPreference("lastSelectedDriver", d.abbreviation); },
      });
    });

    bookmarks.forEach((b) => {
      list.push({
        id: `bookmark-${b.id}`, label: `Jump to bookmark: ${b.label}`, icon: BookmarkIcon,
        run: () => combinedSeek(b.timestamp),
      });
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, preferences, metadata, bookmarks]);

  const filtered = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [commands, query]
  );

  const handleRun = (cmd: Command) => {
    cmd.run();
    toast.info(cmd.label);
    setOpen(false);
    setQuery("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 pt-24"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-4 w-4 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command…"
                aria-label="Search commands"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-muted"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-1">
              {filtered.length === 0 && <p className="p-3 text-xs text-muted">No matching commands.</p>}
              {filtered.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => handleRun(cmd)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-white hover:bg-accent/20 focus:bg-accent/20 focus:outline-none"
                >
                  <cmd.icon className="h-4 w-4 shrink-0 text-accent" />
                  <span className="truncate">{cmd.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
