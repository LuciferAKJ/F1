"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { usePixiReplay } from "@/hooks/usePixiReplay";
import { useReplayStore } from "@/store/replayStore";
import { toCircuitData, toDriverMeta } from "@/types/api";
import { toReplayFrame } from "@/lib/replayAdapter";

export function ReplayCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixiReady, setPixiReady] = useState(false);

  const metadata = useReplayStore((s) => s.metadata);
  const currentFrame = useReplayStore((s) => s.currentFrame);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const setPixiControls = useReplayStore((s) => s.setPixiControls);

  const circuit = useMemo(() => (metadata ? toCircuitData(metadata.circuit) : null), [metadata]);
  const drivers = useMemo(() => (metadata ? metadata.drivers.map(toDriverMeta) : []), [metadata]);
  const frame = useMemo(() => (currentFrame ? toReplayFrame(currentFrame) : null), [currentFrame]);

  const handleReady = useCallback(() => setPixiReady(true), []);

  useEffect(() => {
    setPixiReady(false);
  }, [circuit, drivers.length]);

  const controls = usePixiReplay({ containerRef, circuit, drivers, frame, selectedDriver, onReady: handleReady });

  // Publish imperative camera controls so sidebar/toolbar buttons can drive the canvas.
  useEffect(() => {
    setPixiControls(controls);
    return () => setPixiControls(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuit, drivers.length]);

  const showOverlay = !metadata || !pixiReady;
  const overlayText = !metadata ? "Loading circuit data…" : "Initializing replay engine…";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-black/40">
      <div ref={containerRef} className="h-full w-full" />
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-sm text-muted"
          >
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span>{overlayText}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
