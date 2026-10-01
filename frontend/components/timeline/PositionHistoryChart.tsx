"use client";

import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useReplayStore } from "@/store/replayStore";
import type { RaceIntelligence } from "@/lib/raceIntelligence";

interface PositionHistoryChartProps {
  intelligence: RaceIntelligence | null;
}

export function PositionHistoryChart({ intelligence }: PositionHistoryChartProps) {
  const selectedDriver = useReplayStore((s) => s.selectedDriver);

  const data = useMemo(
    () => (intelligence && selectedDriver ? intelligence.positionHistoryByDriver.get(selectedDriver) ?? [] : []),
    [intelligence, selectedDriver]
  );

  const maxPosition = useMemo(() => {
    let max = 20;
    intelligence?.positionHistoryByDriver.forEach((points) => {
      points.forEach((p) => { if (p.position > max) max = p.position; });
    });
    return max;
  }, [intelligence]);

  if (!selectedDriver) {
    return <p className="text-xs text-muted">Select a driver to see their position history.</p>;
  }
  if (!intelligence) {
    return <p className="text-xs text-muted">Analyzing race data…</p>;
  }
  if (data.length === 0) {
    return <p className="text-xs text-muted">No position history available for {selectedDriver}.</p>;
  }

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">
        {selectedDriver} — Position by Lap
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#222" strokeDasharray="3 3" />
          <XAxis
            dataKey="lap" stroke="#666" fontSize={10}
            label={{ value: "Lap", position: "insideBottom", offset: -2, fontSize: 10, fill: "#666" }}
          />
          <YAxis reversed domain={[1, maxPosition]} allowDecimals={false} stroke="#666" fontSize={10} width={28} />
          <Tooltip
            contentStyle={{ background: "#141414", border: "1px solid #262626", fontSize: 11 }}
            labelFormatter={(v) => `Lap ${v}`}
          />
          <Line type="stepAfter" dataKey="position" stroke="#DA291C" dot={{ r: 2 }} strokeWidth={1.75} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
