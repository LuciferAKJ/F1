"use client";

import { useEffect, useRef } from "react";
import { wsReplayUrl } from "@/lib/apiClient";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";
import type { RawReplayFrame } from "@/lib/replayAdapter";

type ServerMessage =
  | { type: "metadata"; duration: number; frameInterval: number; frameCount: number }
  | { type: "frame"; frame: RawReplayFrame }
  | { type: "error"; message: string };

export const MAX_RECONNECT_ATTEMPTS = 3;
export const MAX_TOTAL_RECONNECT_ATTEMPTS = 5;
export const BASE_RECONNECT_DELAY_MS = 2000;
export const STABLE_CONNECTION_DELAY_MS = 5000;

/** Owns the WebSocket connection for one selected race and keeps the Zustand store
 * in sync: incoming "frame" messages push into the store; outgoing actions mirror
 * play/pause/seek/speed changes made elsewhere in the UI. */
export function useReplayWebSocket(race: SelectedRace | null) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stabilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveAttemptsRef = useRef(0);
  const totalAttemptsRef = useRef(0);
  const pushFrame = useReplayStore((s) => s.pushFrame);

  const playing = useReplayStore((s) => s.playing);
  const playbackSpeed = useReplayStore((s) => s.playbackSpeed);
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);

  const send = (payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(payload));
      } catch (err) {
        console.warn("Failed to send replay WS action:", err);
      }
    }
  };

  // Connect / reconnect whenever the selected race changes.
  useEffect(() => {
    if (!race) return;
    const currentRace = race;
    let isCancelled = false;

    consecutiveAttemptsRef.current = 0;
    totalAttemptsRef.current = 0;

    function connect() {
      if (isCancelled) return;
      try {
        const url = wsReplayUrl(currentRace.year, currentRace.event, currentRace.sessionType);
        const socket = new WebSocket(url);
        socketRef.current = socket;

        socket.onopen = () => {
          if (isCancelled) return;

          // Clear any pending stability timeout
          if (stabilityTimeoutRef.current) {
            clearTimeout(stabilityTimeoutRef.current);
            stabilityTimeoutRef.current = null;
          }

          // Mark connection as stable only after sustained healthy duration
          stabilityTimeoutRef.current = setTimeout(() => {
            consecutiveAttemptsRef.current = 0;
          }, STABLE_CONNECTION_DELAY_MS);

          // Synchronize the latest playback state from store (avoids stale closures)
          const state = useReplayStore.getState();
          send({ action: state.playing ? "play" : "pause" });
          send({ action: "speed", value: state.playbackSpeed });
          if (state.currentTimestamp > 0) {
            send({ action: "seek", time: state.currentTimestamp });
          }
        };

        socket.onmessage = (event) => {
          if (isCancelled) return;
          try {
            const msg = JSON.parse(event.data) as ServerMessage;
            if (msg.type === "frame") pushFrame(msg.frame);
            if (msg.type === "error") console.error("Replay WS error:", msg.message);
          } catch (parseErr) {
            console.warn("Received malformed WebSocket payload:", parseErr);
          }
        };

        socket.onerror = (e) => {
          if (!isCancelled) {
            console.error("Replay WS connection error:", e);
          }
        };

        socket.onclose = (event) => {
          if (isCancelled) return;

          // Cancel the stability timer if connection dropped before reaching stability
          if (stabilityTimeoutRef.current) {
            clearTimeout(stabilityTimeoutRef.current);
            stabilityTimeoutRef.current = null;
          }

          // Bounded reconnect on abnormal closure
          const canRetryConsecutive = consecutiveAttemptsRef.current < MAX_RECONNECT_ATTEMPTS;
          const canRetryTotal = totalAttemptsRef.current < MAX_TOTAL_RECONNECT_ATTEMPTS;

          if (!event.wasClean && canRetryConsecutive && canRetryTotal) {
            consecutiveAttemptsRef.current += 1;
            totalAttemptsRef.current += 1;
            const delay = BASE_RECONNECT_DELAY_MS * Math.pow(1.5, consecutiveAttemptsRef.current - 1);
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          } else if (!event.wasClean) {
            console.warn(
              `Replay WS reconnect halted: reached maximum retry limit (consecutive: ${consecutiveAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}, total: ${totalAttemptsRef.current}/${MAX_TOTAL_RECONNECT_ATTEMPTS})`
            );
          }
        };
      } catch (connErr) {
        console.warn("Failed to create WebSocket instance:", connErr);
      }
    }

    connect();

    return () => {
      isCancelled = true;
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
        stabilityTimeoutRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race?.year, race?.event, race?.sessionType]);

  // Mirror playing/paused state to the server.
  useEffect(() => {
    send({ action: playing ? "play" : "pause" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Mirror playback speed.
  useEffect(() => {
    send({ action: "speed", value: playbackSpeed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackSpeed]);

  return {
    seek: (timestamp: number) => send({ action: "seek", time: timestamp }),
    currentTimestamp,
  };
}
