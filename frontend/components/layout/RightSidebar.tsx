"use client";

import { motion } from "framer-motion";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { LeaderboardPanel } from "@/components/leaderboard/LeaderboardPanel";
import { usePreferences } from "@/hooks/usePreferences";

export function RightSidebar() {
  const { preferences, setPreference } = usePreferences();
  const collapsed = preferences.rightSidebarCollapsed;

  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center p-2">
        <button
          onClick={() => setPreference("rightSidebarCollapsed", false)}
          className="rounded-md p-1.5 text-muted hover:bg-black/40 hover:text-white"
          title="Expand sidebar"
          aria-label="Expand telemetry and leaderboard sidebar"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto p-3"
    >
      <div className="flex justify-start">
        <button
          onClick={() => setPreference("rightSidebarCollapsed", true)}
          className="rounded-md p-1 text-muted hover:bg-black/40 hover:text-white"
          title="Collapse sidebar"
          aria-label="Collapse telemetry and leaderboard sidebar"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <TelemetryPanel />
      <LeaderboardPanel />
    </motion.aside>
  );
}
