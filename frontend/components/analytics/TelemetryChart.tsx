"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, ReferenceLine, ReferenceArea, Brush, CartesianGrid,
} from "recharts";
import type { TelemetryPoint } from "@/hooks/useDriverSeries";

export interface ChartSeries {
  data: TelemetryPoint[];
  color: string;
  label: string;
}

type Variant = "line" | "area" | "step";

interface TelemetryChartProps {
  title: string;
  unit?: string;
  dataKey: keyof TelemetryPoint;
  variant: Variant;
  primary: ChartSeries;
  compare?: ChartSeries | null;
  cursorTime: number;
  zoomIndices: [number, number] | null;
  onZoomIndicesChange: (indices: [number, number] | null) => void;
  onSeek: (t: number) => void;
  yDomain?: [number, number];
  yTicks?: number[];
  redlineFrom?: number; // draws a highlighted band from this value to the top of yDomain
  showBrush?: boolean; // only one chart (Speed) should own the shared zoom brush
  compact?: boolean;
}

interface MergedPoint {
  t: number;
  p?: number;
  c?: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TelemetryChart({
  title, unit, dataKey, variant, primary, compare, cursorTime,
  zoomIndices, onZoomIndicesChange, onSeek, yDomain, yTicks, redlineFrom, showBrush, compact,
}: TelemetryChartProps) {
  const draggingRef = useRef(false);

  useEffect(() => {
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  const merged = useMemo<MergedPoint[]>(() => {
    const map = new Map<number, MergedPoint>();
    for (const pt of primary.data) map.set(pt.t, { t: pt.t, p: pt[dataKey] as number });
    if (compare) {
      for (const pt of compare.data) {
        const existing = map.get(pt.t) ?? { t: pt.t };
        existing.c = pt[dataKey] as number;
        map.set(pt.t, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.t - b.t);
  }, [primary.data, compare, dataKey]);

  const domain: [number | string, number | string] =
    zoomIndices && merged[zoomIndices[0]] && merged[zoomIndices[1]]
      ? [merged[zoomIndices[0]].t, merged[zoomIndices[1]].t]
      : ["dataMin", "dataMax"];

  const height = compact ? 130 : 190;

  type ChartMouseState = { activeLabel?: string | number } | null;

  const handleDown = (e: ChartMouseState) => {
    draggingRef.current = true;
    if (e?.activeLabel !== undefined) onSeek(Number(e.activeLabel));
  };
  const handleMove = (e: ChartMouseState) => {
    if (draggingRef.current && e?.activeLabel !== undefined) onSeek(Number(e.activeLabel));
  };
  const resetZoom = () => onZoomIndicesChange(null);

  return (
    <div className="rounded-lg border border-border bg-black/20 p-2" onDoubleClick={resetZoom}>
      <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
        <span className="font-bold uppercase tracking-wide">{title}{unit ? ` (${unit})` : ""}</span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: primary.color }} />
            {primary.label}
          </span>
          {compare && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: compare.color }} />
              {compare.label}
            </span>
          )}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={merged}
          margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
        >
          <CartesianGrid stroke="#222" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            domain={domain}
            tickFormatter={formatTime}
            stroke="#666"
            fontSize={10}
            allowDataOverflow
          />
          <YAxis domain={yDomain ?? ["auto", "auto"]} ticks={yTicks} stroke="#666" fontSize={10} width={34} />
          <Tooltip
            contentStyle={{ background: "#141414", border: "1px solid #262626", fontSize: 11 }}
            labelFormatter={(v) => formatTime(Number(v))}
          />

          {redlineFrom !== undefined && yDomain && (
            <ReferenceArea y1={redlineFrom} y2={yDomain[1]} fill="#ff3b3b" fillOpacity={0.12} strokeOpacity={0} />
          )}

          {variant === "area" ? (
            <Area type="monotone" dataKey="p" stroke={primary.color} fill={primary.color} fillOpacity={0.25} isAnimationActive={false} dot={false} />
          ) : (
            <Line
              type={variant === "step" ? "stepAfter" : "monotone"}
              dataKey="p"
              stroke={primary.color}
              dot={false}
              strokeWidth={1.75}
              isAnimationActive={false}
            />
          )}

          {compare && (
            <Line
              type={variant === "step" ? "stepAfter" : "monotone"}
              dataKey="c"
              stroke={compare.color}
              dot={false}
              strokeWidth={1.75}
              strokeDasharray="4 2"
              isAnimationActive={false}
            />
          )}

          <ReferenceLine x={cursorTime} stroke="#ffffff" strokeWidth={1.5} strokeOpacity={0.8} />

          {showBrush && (
            <Brush
              dataKey="t"
              height={16}
              stroke="#DA291C"
              travellerWidth={8}
              startIndex={zoomIndices ? zoomIndices[0] : 0}
              endIndex={zoomIndices ? zoomIndices[1] : Math.max(merged.length - 1, 0)}
              onChange={(range) => {
                if (range.startIndex !== undefined && range.endIndex !== undefined) {
                  onZoomIndicesChange([range.startIndex, range.endIndex]);
                }
              }}
              tickFormatter={formatTime}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
