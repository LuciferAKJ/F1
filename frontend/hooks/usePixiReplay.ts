"use client";

import { useEffect, useRef } from "react";
import { PixiReplayEngine } from "@/lib/pixi/PixiReplayEngine";
import { useReplayStore } from "@/store/replayStore";
import type { CircuitData, DriverMeta, ReplayFrame } from "@/types/replay";

interface UsePixiReplayArgs {
  containerRef: React.RefObject<HTMLDivElement | null>;
  circuit: CircuitData | null;
  drivers: DriverMeta[];
  frame: ReplayFrame | null;
  selectedDriver?: string | null;
  onReady?: () => void;
}

/**
 * Mounts a PixiReplayEngine into containerRef once circuit/drivers are available,
 * and pushes each new `frame` into the engine as the timeline advances.
 */
export function usePixiReplay({ containerRef, circuit, drivers, frame, selectedDriver, onReady }: UsePixiReplayArgs) {
  const engineRef = useRef<PixiReplayEngine | null>(null);
  const setFollowedDriver = useReplayStore((s) => s.setFollowedDriver);

  useEffect(() => {
    if (!containerRef.current || !circuit || drivers.length === 0) return;

    const engine = new PixiReplayEngine();
    engine.setFollowChangeHandler((abbr) => {
      setFollowedDriver(abbr);
    });
    engineRef.current = engine;
    let cancelled = false;

    engine.init(containerRef.current, circuit, drivers).then(() => {
      if (cancelled) {
        engine.destroy();
      } else {
        onReady?.();
      }
    });

    return () => {
      cancelled = true;
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuit, drivers.length]);

  useEffect(() => {
    if (frame) engineRef.current?.setFrame(frame);
  }, [frame]);

  useEffect(() => {
    engineRef.current?.setSelectedDriver(selectedDriver ?? null);
  }, [selectedDriver]);

  return {
    zoomIn: () => engineRef.current?.zoomIn(),
    zoomOut: () => engineRef.current?.zoomOut(),
    resetView: () => {
      setFollowedDriver(null);
      engineRef.current?.resetView();
    },
    followDriver: (abbr: string) => {
      setFollowedDriver(abbr);
      engineRef.current?.followDriver(abbr);
    },
    stopFollowing: () => {
      setFollowedDriver(null);
      engineRef.current?.stopFollowing();
    },
  };
}
