"use client";

import { motion } from "framer-motion";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { usePreferences } from "@/hooks/usePreferences";

export function RightSidebar() {
  const { preferences, setPreference } = usePreferences();
  const collapsed = preferences.rightSidebarCollapsed;

  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center p-2 bg-pitwall-dock border-l border-pitwall-hairline">
        <button
          onClick={() => setPreference("rightSidebarCollapsed", false)}
          className="rounded-sm p-1.5 text-pitwall-text-muted hover:bg-pitwall-elevated hover:text-white"
          title="Expand sidebar"
          aria-label="Expand telemetry sidebar"
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
      className="flex w-72 md:w-76 lg:w-[310px] shrink-0 flex-col gap-3 overflow-y-auto p-3 bg-pitwall-dock border-l border-pitwall-hairline"
    >
      <div className="flex justify-start">
        <button
          onClick={() => setPreference("rightSidebarCollapsed", true)}
          className="rounded-sm p-1 text-pitwall-text-muted hover:bg-pitwall-elevated hover:text-white"
          title="Collapse sidebar"
          aria-label="Collapse telemetry sidebar"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <TelemetryPanel />
    </motion.aside>
  );
}
