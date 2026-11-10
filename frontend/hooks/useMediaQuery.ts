"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe, tear-free media query hook using React 18/19 useSyncExternalStore.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined" || !("matchMedia" in window)) {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => {
      if (typeof window === "undefined" || !("matchMedia" in window)) {
        return false;
      }
      return window.matchMedia(query).matches;
    },
    () => false
  );
}

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1279px)");
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1280px)");
}

