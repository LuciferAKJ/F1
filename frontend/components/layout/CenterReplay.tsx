"use client";

import dynamic from "next/dynamic";
import { ZoomIn, ZoomOut, Locate } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const ReplayCanvas = dynamic(
  () => import("@/components/track/ReplayCanvas").then((m) => m.ReplayCanvas),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

function formatRaceTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function CenterReplay() {
  const currentTimestamp = useReplayStore((s) => s.currentTimestamp);
  const currentLap = useReplayStore((s) => s.currentLap);
  const playbackSpeed = useReplayStore((s) => s.playbackSpeed);
  const pixiControls = useReplayStore((s) => s.pixiControls);
  const metadata = useReplayStore((s) => s.metadata);

  return (
    <div className="relative flex-1 p-3">
      <ReplayCanvas />

      <div className="pointer-events-none absolute left-6 top-6 rounded-lg bg-black/60 px-3 py-2 text-sm backdrop-blur-sm">
        <div className="font-bold">Lap {currentLap}{metadata?.totalLaps ? ` / ${metadata.totalLaps}` : ""}</div>
        <div className="text-muted">{formatRaceTime(currentTimestamp)}</div>
        <div className="text-muted">Speed x{playbackSpeed}</div>
      </div>

      <div className="absolute right-6 top-6 flex gap-1.5">
        <Button size="icon" variant="outline" onClick={() => pixiControls?.zoomIn()} title="Zoom in" aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={() => pixiControls?.zoomOut()} title="Zoom out" aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => { pixiControls?.stopFollowing(); pixiControls?.resetView(); }}
          title="Reset view"
          aria-label="Reset camera view"
        >
          <Locate className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
