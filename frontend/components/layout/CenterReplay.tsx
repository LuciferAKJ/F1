"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ZoomIn, ZoomOut, Locate, Crosshair } from "lucide-react";
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
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const followedDriver = useReplayStore((s) => s.followedDriver);

  const pathname = usePathname();
  const isDemo = Boolean(
    pathname?.includes("/replay/demo") ||
    metadata?.isDemo ||
    metadata?.info?.isDemo ||
    selectedRace?.year === 0 ||
    selectedRace?.event?.toLowerCase().includes("demo")
  );

  return (
    <div className="relative flex-1 min-w-0 h-full min-h-0 flex flex-col p-1.5 sm:p-2 lg:p-3 bg-pitwall-canvas overflow-hidden">
      <ReplayCanvas />

      {/* Floating Circuit HUD */}
      <div className="pointer-events-none absolute left-3 top-3 sm:left-5 sm:top-5 rounded-md border border-pitwall-hairline bg-pitwall-dock/90 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs backdrop-blur-sm z-10 font-telemetry">
        <div className="flex items-center gap-1.5 sm:gap-2 font-bold font-display tracking-wider">
          <span className="text-pitwall-text text-[11px] sm:text-xs">
            LAP {currentLap}{metadata?.totalLaps ? ` / ${metadata.totalLaps}` : ""}
          </span>
          {isDemo ? (
            <span
              className="hidden sm:inline-block rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-400 border border-amber-500/30 font-telemetry"
              title="Demonstration dataset - Synthetic track telemetry"
            >
              DEMO DATA
            </span>
          ) : (
            <span
              className="hidden sm:inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-emerald-400 border border-emerald-500/30 font-telemetry"
              title="Real telemetry from official timing"
            >
              REAL DATA
            </span>
          )}
        </div>
        <div className="text-pitwall-telemetry font-tabular text-[11px] sm:text-xs mt-0.5">
          {formatRaceTime(currentTimestamp)}
        </div>
        <div className="text-pitwall-text-muted text-[9px] sm:text-[10px]">
          Speed x{playbackSpeed}
        </div>
      </div>

      {/* Floating Camera Controls */}
      <div className="absolute right-3 top-3 sm:right-5 sm:top-5 flex items-center gap-1 sm:gap-1.5 z-10">
        {followedDriver ? (
          <div className="flex items-center gap-1 sm:gap-1.5 rounded-md border border-pitwall-telemetry/40 bg-pitwall-dock/90 px-2 py-1 text-xs backdrop-blur-sm">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-pitwall-telemetry animate-pulse" aria-hidden="true" />
            <span className="font-semibold text-white font-display uppercase tracking-wider text-[10px] sm:text-xs">
              Following: {followedDriver}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-xs text-pitwall-text-muted hover:text-white hover:bg-pitwall-elevated font-display uppercase"
              onClick={() => {
                pixiControls?.stopFollowing();
                pixiControls?.resetView();
              }}
              title="Return to full-circuit overview"
              aria-label="Return to full-circuit overview"
            >
              Overview
            </Button>
          </div>
        ) : selectedDriver ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 sm:h-8 gap-1 sm:gap-1.5 border-pitwall-hairline bg-pitwall-dock/90 px-2 sm:px-2.5 text-[10px] sm:text-xs font-display uppercase tracking-wider text-pitwall-text hover:bg-pitwall-elevated hover:text-white backdrop-blur-sm"
            onClick={() => pixiControls?.followDriver(selectedDriver)}
            title={`Follow ${selectedDriver} with camera`}
            aria-label={`Follow ${selectedDriver}`}
          >
            <Crosshair className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-pitwall-telemetry" />
            <span className="hidden xs:inline">Follow</span> {selectedDriver}
          </Button>
        ) : null}

        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 sm:h-8 sm:w-8 border-pitwall-hairline bg-pitwall-dock/90 text-pitwall-text-muted hover:text-white hover:bg-pitwall-elevated"
          onClick={() => pixiControls?.zoomIn()}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 sm:h-8 sm:w-8 border-pitwall-hairline bg-pitwall-dock/90 text-pitwall-text-muted hover:text-white hover:bg-pitwall-elevated"
          onClick={() => pixiControls?.zoomOut()}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 sm:h-8 sm:w-8 border-pitwall-hairline bg-pitwall-dock/90 text-pitwall-text-muted hover:text-white hover:bg-pitwall-elevated"
          onClick={() => { pixiControls?.stopFollowing(); pixiControls?.resetView(); }}
          title="Reset camera view to full circuit"
          aria-label="Reset camera view"
        >
          <Locate className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  );
}
