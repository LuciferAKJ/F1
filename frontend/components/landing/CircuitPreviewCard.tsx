"use client";

import React, { useMemo } from "react";
import { MapPin, Navigation, Gauge, Zap } from "lucide-react";

interface CircuitInfo {
  name: string;
  location: string;
  lengthKm: string;
  turns: number;
  drsZones: number;
  svgPath: string;
  viewBox: string;
}

const CIRCUIT_DATABASE: Record<string, CircuitInfo> = {
  bahrain: {
    name: "Bahrain International Circuit",
    location: "Sakhir, Bahrain",
    lengthKm: "5.412 km",
    turns: 15,
    drsZones: 3,
    viewBox: "0 0 500 350",
    svgPath: "M 100 280 L 320 280 Q 360 280 370 250 L 380 180 Q 390 150 430 150 Q 450 150 450 120 Q 450 90 400 80 L 260 80 Q 240 80 230 110 L 220 150 Q 210 180 170 180 L 120 180 Q 80 180 70 220 Z",
  },
  monza: {
    name: "Autodromo Nazionale Monza",
    location: "Monza, Italy",
    lengthKm: "5.793 km",
    turns: 11,
    drsZones: 2,
    viewBox: "0 0 500 350",
    svgPath: "M 80 290 L 410 290 Q 440 290 440 250 L 440 180 Q 440 120 380 90 L 220 70 Q 180 70 170 100 L 150 160 Q 140 190 100 200 L 70 220 Q 60 250 80 290 Z",
  },
  silverstone: {
    name: "Silverstone Circuit",
    location: "Silverstone, United Kingdom",
    lengthKm: "5.891 km",
    turns: 18,
    drsZones: 2,
    viewBox: "0 0 500 350",
    svgPath: "M 120 260 L 280 260 Q 320 260 350 220 L 430 180 Q 450 160 430 120 L 360 80 Q 320 60 280 80 L 180 120 Q 140 130 120 170 L 100 210 Q 90 250 120 260 Z",
  },
  spa: {
    name: "Circuit de Spa-Francorchamps",
    location: "Stavelot, Belgium",
    lengthKm: "7.004 km",
    turns: 19,
    drsZones: 2,
    viewBox: "0 0 500 350",
    svgPath: "M 90 270 L 240 270 Q 280 270 300 230 L 380 140 Q 420 100 450 110 Q 470 120 460 160 L 400 240 Q 370 280 320 280 L 180 290 Q 110 290 90 270 Z",
  },
  monaco: {
    name: "Circuit de Monaco",
    location: "Monte Carlo, Monaco",
    lengthKm: "3.337 km",
    turns: 19,
    drsZones: 1,
    viewBox: "0 0 500 350",
    svgPath: "M 110 250 L 290 270 Q 340 280 380 240 L 420 180 Q 440 140 400 110 L 300 90 Q 250 80 210 110 L 170 150 Q 140 180 100 190 Q 80 210 110 250 Z",
  },
  "abu dhabi": {
    name: "Yas Marina Circuit",
    location: "Yas Island, Abu Dhabi",
    lengthKm: "5.281 km",
    turns: 16,
    drsZones: 2,
    viewBox: "0 0 500 350",
    svgPath: "M 110 260 L 330 260 Q 370 260 380 220 L 390 140 Q 400 90 350 80 L 220 70 Q 180 70 160 100 L 150 160 Q 130 210 90 230 Q 80 250 110 260 Z",
  },
  generic: {
    name: "Grand Prix Circuit",
    location: "FIA Grade 1 Circuit",
    lengthKm: "5.320 km",
    turns: 16,
    drsZones: 2,
    viewBox: "0 0 500 350",
    svgPath: "M 120 260 L 340 260 Q 390 260 410 220 L 430 160 Q 440 110 390 90 L 260 80 Q 210 80 180 110 L 150 160 Q 120 200 90 220 Q 80 250 120 260 Z",
  },
};

interface CircuitPreviewCardProps {
  eventName: string;
  country: string;
  location?: string;
  roundNumber?: number;
  totalLaps?: number | null;
  className?: string;
}

export function CircuitPreviewCard({
  eventName,
  country,
  location,
  roundNumber,
  totalLaps,
  className = "",
}: CircuitPreviewCardProps) {
  const circuit = useMemo(() => {
    const key = Object.keys(CIRCUIT_DATABASE).find((k) =>
      eventName.toLowerCase().includes(k) || country.toLowerCase().includes(k)
    );
    if (key && CIRCUIT_DATABASE[key]) {
      return CIRCUIT_DATABASE[key];
    }
    return {
      ...CIRCUIT_DATABASE.generic,
      name: `${eventName.replace("Grand Prix", "").trim()} Circuit`,
      location: location ? `${location}, ${country}` : country,
    };
  }, [eventName, country, location]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-pitwall-hairline bg-pitwall-dock/90 p-5 shadow-2xl backdrop-blur-md ${className}`}
      data-testid="circuit-preview-card"
    >
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-pitwall-telemetry/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-pitwall-signal/10 blur-3xl" />

      {/* Header Info */}
      <div className="relative z-10 flex items-start justify-between gap-4 border-b border-pitwall-hairline/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            {roundNumber !== undefined && roundNumber > 0 && (
              <span className="inline-block rounded bg-pitwall-surface px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-pitwall-text-muted border border-pitwall-hairline">
                ROUND {roundNumber}
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-pitwall-telemetry">
              <span className="h-1.5 w-1.5 rounded-full bg-pitwall-telemetry animate-pulse" />
              FIA GRADE 1
            </span>
          </div>
          <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-pitwall-text sm:text-2xl">
            {circuit.name}
          </h3>
          <p className="flex items-center gap-1.5 text-xs text-pitwall-text-muted">
            <MapPin className="h-3.5 w-3.5 text-pitwall-signal shrink-0" />
            <span>{circuit.location || country}</span>
          </p>
        </div>

        <div className="text-right">
          <div className="font-mono text-xs text-pitwall-text-muted">CIRCUIT LENGTH</div>
          <div className="font-mono text-lg font-bold text-pitwall-text">{circuit.lengthKm}</div>
        </div>
      </div>

      {/* Vector Circuit Canvas */}
      <div className="relative my-4 flex h-48 w-full items-center justify-center sm:h-56">
        <svg
          viewBox={circuit.viewBox}
          className="h-full w-full max-w-[420px] drop-shadow-[0_0_15px_rgba(0,200,232,0.25)] transition-transform duration-500 hover:scale-105"
          aria-label={`Track map of ${circuit.name}`}
        >
          <defs>
            <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00C8E8" />
              <stop offset="50%" stopColor="#62E2FF" />
              <stop offset="100%" stopColor="#00A3C4" />
            </linearGradient>
            <filter id="trackGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background track silhouette */}
          <path
            d={circuit.svgPath}
            fill="none"
            stroke="#1C2530"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Main glowing racing line */}
          <path
            d={circuit.svgPath}
            fill="none"
            stroke="url(#trackGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#trackGlow)"
          />

          {/* Start/Finish Line marker */}
          <circle cx="100" cy="280" r="4.5" fill="#E10600" stroke="#FFFFFF" strokeWidth="1.5" />
          <text
            x="100"
            y="306"
            fill="#EAF0F5"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
            fontWeight="bold"
          >
            START / FINISH
          </text>
        </svg>
      </div>

      {/* Circuit Telemetry Specs Footer */}
      <div className="relative z-10 grid grid-cols-3 gap-2 rounded-lg border border-pitwall-hairline/60 bg-pitwall-surface/70 p-3 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider text-pitwall-text-muted">
            <Navigation className="h-3 w-3 text-pitwall-telemetry" />
            <span>Turns</span>
          </div>
          <div className="mt-0.5 font-mono text-base font-bold text-pitwall-text">
            {circuit.turns}
          </div>
        </div>

        <div className="border-x border-pitwall-hairline/60">
          <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider text-pitwall-text-muted">
            <Zap className="h-3 w-3 text-pitwall-drs" />
            <span>DRS Zones</span>
          </div>
          <div className="mt-0.5 font-mono text-base font-bold text-pitwall-drs">
            {circuit.drsZones}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider text-pitwall-text-muted">
            <Gauge className="h-3 w-3 text-pitwall-signal" />
            <span>Race Laps</span>
          </div>
          <div className="mt-0.5 font-mono text-base font-bold text-pitwall-text">
            {totalLaps ?? "57"}
          </div>
        </div>
      </div>
    </div>
  );
}
