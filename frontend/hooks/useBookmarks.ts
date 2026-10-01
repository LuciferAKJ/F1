"use client";

import { useCallback, useEffect, useState } from "react";
import type { SelectedRace } from "@/store/replayStore";

export interface Bookmark {
  id: string;
  timestamp: number;
  label: string;
  createdAt: number;
}

function storageKey(race: SelectedRace): string {
  return `f1-replay-bookmarks:${race.year}-${race.event}-${race.sessionType}`;
}

/** Replay bookmarks, persisted purely client-side in localStorage (no backend). */
export function useBookmarks(race: SelectedRace | null) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    if (!race) {
      setBookmarks([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(race));
      setBookmarks(raw ? (JSON.parse(raw) as Bookmark[]) : []);
    } catch {
      setBookmarks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race?.year, race?.event, race?.sessionType]);

  const persist = useCallback(
    (next: Bookmark[]) => {
      setBookmarks(next);
      if (race) {
        try {
          localStorage.setItem(storageKey(race), JSON.stringify(next));
        } catch {
          // localStorage unavailable (private browsing, quota, etc.) — bookmark just won't persist.
        }
      }
    },
    [race]
  );

  const addBookmark = useCallback(
    (timestamp: number, label: string) => {
      const bookmark: Bookmark = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp, label, createdAt: Date.now(),
      };
      persist([...bookmarks, bookmark].sort((a, b) => a.timestamp - b.timestamp));
    },
    [bookmarks, persist]
  );

  const removeBookmark = useCallback(
    (id: string) => persist(bookmarks.filter((b) => b.id !== id)),
    [bookmarks, persist]
  );

  return { bookmarks, addBookmark, removeBookmark };
}
