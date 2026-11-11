"use client";

import React, { useMemo } from "react";
import { MapPin, Gauge, Users, Route, AlertTriangle } from "lucide-react";
import type { CircuitDataDTO } from "@/types/api";

interface CircuitPreviewCardProps {
  eventName: string;
  country: string;
  location?: string;
  roundNumber?: number;
  totalLaps?: number | null;
  driverCount?: number | null;
  circuit?: CircuitDataDTO | null;
  isDemo?: boolean;
  className?: string;
}

function buildNormalizedTrackPoints(circuit: CircuitDataDTO): {
  pathD: string;
  startX: number;
  startY: number;
} | null {
  const { x, y, minX, maxX, minY, maxY } = circuit;
  if (!x || !y || x.length < 2 || x.length !== y.length) return null;

  const width = 400;
  const height = 280;
  const pad = 28;
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);

  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offsetX = (width - drawnW) / 2;
  const offsetY = (height - drawnH) / 2;

  const projectX = (vx: number) => Number((offsetX + (vx - minX) * scale).toFixed(2));
  const projectY = (vy: number) => Number((height - (offsetY + (vy - minY) * scale)).toFixed(2));

  const cmds: string[] = [];
  for (let i = 0; i < x.length; i++) {
    const px = projectX(x[i]);
    const py = projectY(y[i]);
    cmds.push(`${i === 0 ? "M" : "L"} ${px} ${py}`);
  }
  cmds.push("Z");

  return {
    pathD: cmds.join(" "),
    startX: projectX(x[0]),
    startY: projectY(y[0]),
  };
}

export function CircuitPreviewCard({
  eventName,
  country,
  location,
  roundNumber,
  totalLaps,
  driverCount,
  circuit,
  isDemo = false,
  className = "",
}: CircuitPreviewCardProps) {
  const projected = useMemo(() => {
    if (!circuit) return null;
    return buildNormalizedTrackPoints(circuit);
  }, [circuit]);

  const locationLabel =
    location && location !== country ? `${location}, ${country}` : country || "Location unavailable";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-pitwall-hairline bg-pitwall-dock/90 p-5 shadow-2xl backdrop-blur-md ${className}`}
      data-testid="circuit-preview-card"
    >
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-pitwall-telemetry/10 blur-3xl" />

      {/* Header Info */}
      <div className="relative z-10 flex items-start justify-between gap-4 border-b border-pitwall-hairline/60 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {roundNumber !== undefined && roundNumber > 0 && (
              <span className="inline-block rounded bg-pitwall-surface px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-pitwall-text-muted border border-pitwall-hairline">
                ROUND {roundNumber}
              </span>
            )}
            {projected ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-pitwall-telemetry">
                <span className="h-1.5 w-1.5 rounded-full bg-pitwall-telemetry" />
                {isDemo ? "SAMPLE TRACK GEOMETRY" : "VERIFIED CIRCUIT GEOMETRY"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-pitwall-text-muted">
                GEOMETRY NOT VERIFIED
              </span>
            )}
          </div>
          <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-pitwall-text sm:text-2xl">
            {eventName}
          </h3>
          <p className="flex items-center gap-1.5 text-xs text-pitwall-text-muted">
            <MapPin className="h-3.5 w-3.5 text-pitwall-signal shrink-0" />
            <span>{locationLabel}</span>
          </p>
        </div>
      </div>

      {/* Actual Circuit Canvas OR Neutral Unavailable State */}
      <div className="relative my-4 flex h-48 w-full items-center justify-center sm:h-56">
        {projected ? (
          <svg
            viewBox="0 0 400 280"
            className="h-full w-full max-w-[400px] drop-shadow-[0_0_15px_rgba(0,200,232,0.25)]"
            aria-label={`Verified track geometry for ${eventName}`}
            data-testid="verified-circuit-svg"
          >
            <defs>
              <linearGradient id="trackGradVerified" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00C8E8" />
                <stop offset="50%" stopColor="#62E2FF" />
                <stop offset="100%" stopColor="#00A3C4" />
              </linearGradient>
            </defs>

            {/* Outer track shoulder */}
            <path
              d={projected.pathD}
              fill="none"
              stroke="#1C2530"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Main telemetry path */}
            <path
              d={projected.pathD}
              fill="none"
              stroke="url(#trackGradVerified)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Telemetry Origin Point */}
            <circle
              cx={projected.startX}
              cy={projected.startY}
              r="5"
              fill="#E10600"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          </svg>
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed border-pitwall-hairline/80 bg-pitwall-surface/30 px-6 text-center"
            data-testid="circuit-preview-unavailable"
          >
            <AlertTriangle className="h-7 w-7 text-pitwall-text-muted/60" />
            <p className="mt-2 font-mono text-xs font-semibold text-pitwall-text">
              Circuit preview unavailable
            </p>
            <p className="mt-1 max-w-xs text-[11px] text-pitwall-text-muted leading-relaxed">
              Track geometry is rendered from verified session telemetry rather than illustrative placeholders. Check availability to load this track map.
            </p>
          </div>
        )}
      </div>

      {/* Truthful Telemetry Metrics Footer */}
      <div className="relative z-10 grid grid-cols-3 gap-2 rounded-lg border border-pitwall-hairline/60 bg-pitwall-surface/70 p-3 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider text-pitwall-text-muted">
            <Gauge className="h-3 w-3 text-pitwall-signal" />
            <span>Laps</span>
          </div>
          <div className="mt-0.5 font-mono text-sm sm:text-base font-bold text-pitwall-text">
            {projected && totalLaps ? totalLaps : "—"}
          </div>
        </div>

        <div className="border-x border-pitwall-hairline/60">
          <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider text-pitwall-text-muted">
            <Users className="h-3 w-3 text-pitwall-telemetry" />
            <span>Drivers</span>
          </div>
          <div className="mt-0.5 font-mono text-sm sm:text-base font-bold text-pitwall-text">
            {projected && driverCount ? driverCount : "—"}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider text-pitwall-text-muted">
            <Route className="h-3 w-3 text-pitwall-drs" />
            <span>Samples</span>
          </div>
          <div className="mt-0.5 font-mono text-sm sm:text-base font-bold text-pitwall-text">
            {projected && circuit ? circuit.x.length : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
