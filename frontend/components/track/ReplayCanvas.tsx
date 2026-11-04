"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2, Play, RotateCcw } from "lucide-react";
import { usePixiReplay } from "@/hooks/usePixiReplay";
import { useReplayStore } from "@/store/replayStore";
import { toCircuitData, toDriverMeta } from "@/types/api";
import { toReplayFrame } from "@/lib/replayAdapter";
import { Button } from "@/components/ui/button";

export function ReplayCanvas() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixiReady, setPixiReady] = useState(false);

  const metadata = useReplayStore((s) => s.metadata);
  const metadataError = useReplayStore((s) => s.metadataError);
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

  const showLoading = !metadataError && (!metadata || !pixiReady);
  const overlayText = !metadata ? "Loading circuit data…" : "Initializing replay engine…";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-black/40">
      <div ref={containerRef} className="h-full w-full" data-testid="replay-canvas" />
      <AnimatePresence>
        {showLoading && (
          <motion.div
            key="loading-overlay"
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
        {metadataError && (
          <motion.div
            key="error-overlay"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/85 backdrop-blur-md z-20"
          >
            <div className="max-w-md rounded-xl border border-red-500/30 bg-panel/95 p-6 shadow-2xl text-left">
              <div className="flex items-center gap-2.5 text-red-400 mb-3">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <h3 className="text-base font-bold text-white">Real Telemetry Unavailable</h3>
              </div>
              <p className="text-xs text-muted mb-4 leading-relaxed">
                Formula 1 restricted unauthenticated access to recent live-timing archives, or timing data is unavailable for this session.
              </p>
              <div className="rounded-lg bg-black/50 border border-amber-500/20 p-3 mb-5 text-xs text-muted">
                <p className="font-semibold text-amber-400 mb-1">Interactive Demo Replay Available</p>
                You can still explore all platform capabilities (car tracking, speed charts, telemetry, timeline) with the offline <strong className="text-white">Demo Grand Prix</strong> dataset.
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  className="flex-1 bg-amber-500 text-black hover:bg-amber-400 font-semibold text-xs"
                  onClick={() => router.push("/replay/demo")}
                >
                  <Play className="h-3.5 w-3.5 mr-1 fill-black" />
                  Launch Demo Replay
                </Button>
                <Button
                  variant="outline"
                  className="text-xs"
                  onClick={() => router.push("/")}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Change Race
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
