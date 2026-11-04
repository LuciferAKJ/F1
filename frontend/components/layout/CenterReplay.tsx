"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
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
  const selectedRace = useReplayStore((s) => s.selectedRace);

  const pathname = usePathname();
  const isDemo = Boolean(
    pathname?.includes("/replay/demo") ||
    metadata?.isDemo ||
    metadata?.info?.isDemo ||
    selectedRace?.year === 0 ||
    selectedRace?.event?.toLowerCase().includes("demo")
  );

  return (
    <div className="relative flex-1 h-full min-h-0 flex flex-col p-3">
      <ReplayCanvas />

      <div className="pointer-events-none absolute left-6 top-6 rounded-lg bg-black/60 px-3 py-2 text-sm backdrop-blur-sm">
        <div className="flex items-center gap-2 font-bold">
          <span>Lap {currentLap}{metadata?.totalLaps ? ` / ${metadata.totalLaps}` : ""}</span>
          {isDemo ? (
            <span
              className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-400 border border-amber-500/30"
              title="Demonstration dataset - Synthetic track telemetry"
            >
              DEMO DATA
            </span>
          ) : (
            <span
              className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 border border-emerald-500/30"
              title="Real telemetry from official timing"
            >
              REAL RACE DATA
            </span>
          )}
        </div>
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
