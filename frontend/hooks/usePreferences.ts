"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Note on "theme": the app is an intentionally dark, broadcast-style F1 UI —
 * there's no light theme implemented, so this key is stored for forward
 * compatibility (and shown as "Dark" in the command palette) but doesn't
 * currently switch anything. See README roadmap.
 */
export interface Preferences {
  theme: "dark";
  compactMode: boolean;
  lastSelectedDriver: string | null;
  playbackSpeed: number;
  comparisonMode: boolean;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
}

const STORAGE_KEY = "f1-replay-preferences";

const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  compactMode: false,
  lastSelectedDriver: null,
  playbackSpeed: 1,
  comparisonMode: false,
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
};

function readStoredPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Simple localStorage-backed preferences store, shared across components via
 * a module-level listener set so every instance stays in sync without prop drilling. */
const listeners = new Set<(prefs: Preferences) => void>();
let current: Preferences = DEFAULT_PREFERENCES;
let hydrated = false;

function persist(next: Preferences) {
  current = next;
  listeners.forEach((l) => l(next));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — preferences just won't persist across reloads.
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(current);

  useEffect(() => {
    if (!hydrated) {
      hydrated = true;
      current = readStoredPreferences();
    }
    setPrefs(current);
    const listener = (next: Preferences) => setPrefs(next);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const setPreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    persist({ ...current, [key]: value });
  }, []);

  return { preferences: prefs, setPreference };
}
