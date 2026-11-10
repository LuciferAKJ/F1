"use client";

import { motion } from "framer-motion";
import { PanelRightOpen } from "lucide-react";
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
          className="rounded-sm p-1.5 text-pitwall-text-muted hover:bg-pitwall-elevated hover:text-white transition-colors"
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
      className="flex w-72 md:w-80 lg:w-[310px] shrink-0 flex-col overflow-hidden bg-pitwall-dock border-l border-pitwall-hairline h-full min-h-0 select-none"
    >
      <TelemetryPanel onCollapse={() => setPreference("rightSidebarCollapsed", true)} />
    </motion.aside>
  );
}
