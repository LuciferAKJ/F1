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

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY_MS = 2000;

/** Owns the WebSocket connection for one selected race and keeps the Zustand store
 * in sync: incoming "frame" messages push into the store; outgoing actions mirror
 * play/pause/seek/speed changes made elsewhere in the UI. */
export function useReplayWebSocket(race: SelectedRace | null) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
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

    function connect() {
      if (isCancelled) return;
      try {
        const url = wsReplayUrl(currentRace.year, currentRace.event, currentRace.sessionType);
        const socket = new WebSocket(url);
        socketRef.current = socket;

        socket.onopen = () => {
          if (isCancelled) return;
          reconnectAttemptsRef.current = 0;
          // Synchronize initial playback state upon connection
          send({ action: playing ? "play" : "pause" });
          send({ action: "speed", value: playbackSpeed });
          if (currentTimestamp > 0) {
            send({ action: "seek", time: currentTimestamp });
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
          // Bounded reconnect on abnormal closure (e.g. temporary server restart)
          if (!event.wasClean && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current += 1;
            const delay = BASE_RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttemptsRef.current - 1);
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          }
        };
      } catch (connErr) {
        console.warn("Failed to create WebSocket instance:", connErr);
      }
    }

    connect();

    return () => {
      isCancelled = true;
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
