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

/** Owns the WebSocket connection for one selected race and keeps the Zustand store
 * in sync: incoming "frame" messages push into the store; outgoing actions mirror
 * play/pause/seek/speed changes made elsewhere in the UI. */
export function useReplayWebSocket(race: SelectedRace | null) {
  const socketRef = useRef<WebSocket | null>(null);
  const pushFrame = useReplayStore((s) => s.pushFrame);

  const playing = useReplayStore((s) => s.playing);
  const playbackSpeed = useReplayStore((s) => s.playbackSpeed);
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);

  // Connect / reconnect whenever the selected race changes.
  useEffect(() => {
    if (!race) return;
    const socket = new WebSocket(wsReplayUrl(race.year, race.event, race.sessionType));
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      if (msg.type === "frame") pushFrame(msg.frame);
      if (msg.type === "error") console.error("Replay WS error:", msg.message);
    };
    socket.onerror = (e) => console.error("Replay WS connection error:", e);

    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race?.year, race?.event, race?.sessionType]);

  const send = (payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  };

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
