"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Activity, Crosshair, Lock, ShieldAlert, PanelRightClose } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import { cn } from "@/lib/utils";

/**
 * Formula 1 Pit-Wall Telemetry Workstation Deck.
 *
 * DATA INTEGRITY CONTRACT:
 * - Speed (km/h): REAL (FastF1 telemetry stream)
 * - RPM: REAL (FastF1 telemetry stream)
 * - Gear (0-8): REAL (FastF1 telemetry stream)
 * - Throttle (%): REAL (FastF1 telemetry stream)
 * - Brake: REAL BOOLEAN (binary ON/OFF; not a fabricated analog percentage)
 * - DRS (status code): REAL (FastF1 10/12/14 = OPEN, others = CLOSED)
 * - Tyre Compound: REAL (Soft, Medium, Hard, Intermediate, Wet)
 * - Tyre Age: ESTIMATED client-side (laps on current compound, labeled "est.")
 * - Peak Speed: DERIVED from available frame history for selected driver
 * - Rolling Traces: REAL synchronized history from active replay buffer
 *
 * STRICTLY UNAVAILABLE IN PIPELINE (Rendered as disabled / N/A, never fabricated):
 * - ERS battery harvest/deploy %
 * - Pit lane speed limiter state
 * - Tyre surface/carcass temperature & wear degradation %
 * - Brake rotor temperatures
 * - Steering wheel angle
 * - Longitudinal & lateral G-force
 */

const RPM_MAX = 12000;
const SPEED_MAX = 360;

const COMPOUND_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SOFT: { bg: "#DA291C", text: "#FFFFFF", border: "#E10600" },
  MEDIUM: { bg: "#FFD12E", text: "#000000", border: "#FFB020" },
  HARD: { bg: "#F0F0F0", text: "#000000", border: "#FFFFFF" },
  INTERMEDIATE: { bg: "#43B02A", text: "#FFFFFF", border: "#37D67A" },
  WET: { bg: "#0067AD", text: "#FFFFFF", border: "#00C8E8" },
  UNKNOWN: { bg: "#888888", text: "#FFFFFF", border: "#555555" },
};

function isDrsOpen(drs: number): boolean {
  return drs === 10 || drs === 12 || drs === 14;
}

/**
 * Smoothly interpolates numeric values via Framer Motion spring while
 * throttling text updates to integer frames for jitter-free display.
 */
function useAnimatedNumber(target: number, config = { stiffness: 140, damping: 22 }) {
  const motionVal = useMotionValue(target);
  const spring = useSpring(motionVal, config);
  const [display, setDisplay] = useState(() => Math.round(target || 0));
  const lastDisplayRef = useRef(Math.round(target || 0));

  useEffect(() => {
    motionVal.set(target || 0);
  }, [target, motionVal]);

  useEffect(() => {
    let animFrame: number | null = null;
    const unsub = spring.on("change", (v) => {
      const rounded = Math.round(v);
      if (rounded !== lastDisplayRef.current) {
        lastDisplayRef.current = rounded;
        if (animFrame === null) {
          animFrame = requestAnimationFrame(() => {
            animFrame = null;
            setDisplay(lastDisplayRef.current);
          });
        }
      }
    });
    return () => {
      unsub();
      if (animFrame !== null) cancelAnimationFrame(animFrame);
    };
  }, [spring]);

  return { spring, display };
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(startAngle: number, endAngle: number, r: number, cx: number, cy: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

const START_ANGLE = -125;
const END_ANGLE = 125;
const SWEEP = END_ANGLE - START_ANGLE;

/**
 * Formula 1 LED Shift Lights / Rev Bar.
 * 15 discrete LED segment indicators across the rev range.
 */
const RevLimiterBar = memo(function RevLimiterBar({ rpm }: { rpm: number }) {
  const safeRpm = Math.max(0, rpm || 0);
  const normalized = Math.max(0, Math.min(1, safeRpm / RPM_MAX));
  const activeCount = Math.floor(normalized * 15);
  const isRedline = safeRpm >= 11500;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-pitwall-text-muted">
        <span>RPM SHIFT ARRAY</span>
        <span className={cn("font-bold tabular-nums", isRedline ? "text-pitwall-signal animate-pulse" : "text-pitwall-text")}>
          {safeRpm.toLocaleString()} RPM
        </span>
      </div>
      <div
        className={cn(
          "grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 rounded p-1 transition-colors",
          isRedline ? "bg-pitwall-signal/15 border border-pitwall-signal/40" : "bg-pitwall-surface/80"
        )}
      >
        {Array.from({ length: 15 }).map((_, i) => {
          const isActive = i < activeCount;
          let activeColor = "bg-pitwall-drs"; // Green (0-4)
          if (i >= 5 && i < 10) activeColor = "bg-pitwall-warning"; // Amber (5-9)
          if (i >= 10) activeColor = isRedline ? "bg-pitwall-signal shadow-[0_0_6px_#E10600]" : "bg-pitwall-telemetry"; // Red / Over-rev (10-14)

          return (
            <span
              key={i}
              className={cn(
                "h-2 w-full rounded-[1px] transition-all duration-75",
                isActive ? activeColor : "bg-pitwall-canvas/60 opacity-30"
              )}
            />
          );
        })}
      </div>
    </div>
  );
});

/**
 * Dial Speedometer with peak speed indicator.
 */
const SpeedDial = memo(function SpeedDial({ speed, peakSpeed }: { speed: number; peakSpeed: number }) {
  const { spring, display } = useAnimatedNumber(speed);
  const angle = useTransform(spring, (v) => START_ANGLE + (Math.min(v, SPEED_MAX) / SPEED_MAX) * SWEEP);
  const path = useTransform(angle, (a) => arcPath(START_ANGLE, a, 36, 48, 48));
  const track = arcPath(START_ANGLE, END_ANGLE, 36, 48, 48);

  return (
    <div className="flex flex-col items-center justify-center p-1">
      <div className="relative h-20 w-24">
        <svg viewBox="0 0 96 76" className="h-full w-full">
          <path d={track} stroke="#1F2A36" strokeWidth={5} fill="none" strokeLinecap="round" />
          <motion.path d={path} stroke="#00C8E8" strokeWidth={5} fill="none" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 -mt-1 flex flex-col items-center justify-center">
          <span className="font-telemetry text-2xl font-bold leading-none tabular-nums text-pitwall-text">
            {display}
          </span>
          <span className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-pitwall-text-muted">
            KM/H
          </span>
        </div>
      </div>
      <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-pitwall-text-muted">
        <span>PEAK:</span>
        <span className="font-bold text-pitwall-telemetry-light tabular-nums">{peakSpeed}</span>
        <span>KM/H</span>
      </div>
    </div>
  );
});

/**
 * Center Tactical Gear Indicator & DRS Alert Box.
 */
const GearCenterBlock = memo(function GearCenterBlock({
  gear,
  drs,
}: {
  gear: number;
  drs: number;
}) {
  const drsOpen = isDrsOpen(drs);

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-md bg-pitwall-dock/90 p-2 min-w-[72px]">
      <span className="font-mono text-[9px] uppercase tracking-widest text-pitwall-text-muted">
        GEAR
      </span>
      <motion.span
        key={gear}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 450, damping: 25 }}
        className="font-display text-4xl font-black leading-none text-pitwall-telemetry"
      >
        {gear === 0 ? "N" : gear}
      </motion.span>
      <span
        className={cn(
          "font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all",
          drsOpen
            ? "bg-pitwall-drs text-black shadow-[0_0_8px_rgba(55,214,122,0.5)] animate-pulse"
            : "bg-pitwall-surface text-pitwall-text-muted/60"
        )}
      >
        {drsOpen ? "DRS OPEN" : "DRS CLSD"}
      </span>
    </div>
  );
});

/**
 * Dial RPM Gauge with redline warning.
 */
const RpmDial = memo(function RpmDial({ rpm }: { rpm: number }) {
  const { spring, display } = useAnimatedNumber(rpm, { stiffness: 160, damping: 22 });
  const angle = useTransform(spring, (v) => START_ANGLE + (Math.min(v, RPM_MAX) / RPM_MAX) * SWEEP);
  const path = useTransform(angle, (a) => arcPath(START_ANGLE, a, 36, 48, 48));
  const track = arcPath(START_ANGLE, END_ANGLE, 36, 48, 48);
  const isRedline = rpm >= 11500;

  return (
    <div className="flex flex-col items-center justify-center p-1">
      <div className="relative h-20 w-24">
        <svg viewBox="0 0 96 76" className="h-full w-full">
          <path d={track} stroke="#1F2A36" strokeWidth={5} fill="none" strokeLinecap="round" />
          <motion.path
            d={path}
            stroke={isRedline ? "#E10600" : "#37D67A"}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 -mt-1 flex flex-col items-center justify-center">
          <span className="font-telemetry text-base font-bold leading-none tabular-nums text-pitwall-text">
            {(display / 1000).toFixed(1)}k
          </span>
          <span className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-pitwall-text-muted">
            RPM
          </span>
        </div>
      </div>
      <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px]">
        {isRedline ? (
          <span className="font-bold text-pitwall-signal animate-pulse">OVER-REV</span>
        ) : (
          <span className="text-pitwall-text-muted">MAX: 12.0k</span>
        )}
      </div>
    </div>
  );
});

/**
 * Controls Telemetry Inputs (Throttle and Honest Binary Brake).
 */
const ControlInputs = memo(function ControlInputs({
  throttle,
  brake,
}: {
  throttle: number;
  brake: boolean;
}) {
  const { spring: throttleSpring, display: throttleDisplay } = useAnimatedNumber(throttle);
  const throttleWidth = useTransform(throttleSpring, (v) => `${Math.max(0, Math.min(100, v))}%`);

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-pitwall-surface/60 p-2.5">
      {/* Throttle Bar */}
      <div>
        <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
          <span className="uppercase tracking-wider text-pitwall-text-muted">THROTTLE</span>
          <span className="font-bold text-pitwall-drs tabular-nums">{throttleDisplay}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-[2px] bg-pitwall-canvas">
          <motion.div className="h-full bg-pitwall-drs" style={{ width: throttleWidth }} />
        </div>
      </div>

      {/* Brake (Honest Binary Channel) */}
      <div>
        <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
          <span className="uppercase tracking-wider text-pitwall-text-muted">BRAKE</span>
          <span
            className={cn(
              "font-bold tabular-nums text-[10px]",
              brake ? "text-pitwall-signal animate-pulse" : "text-pitwall-text-muted"
            )}
          >
            {brake ? "BRAKE ON" : "BRAKE OFF"}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-[2px] bg-pitwall-canvas">
          <div
            className={cn(
              "h-full transition-all duration-75",
              brake ? "w-full bg-pitwall-signal" : "w-0 bg-transparent"
            )}
          />
        </div>
      </div>
    </div>
  );
});

/**
 * Synchronized Rolling Telemetry Multi-Trace Graph.
 * Real data rendered from the replay store's rolling frame buffer.
 */
const SynchronizedTraces = memo(function SynchronizedTraces({
  history,
}: {
  history: { speed: number; throttle: number; brake: boolean }[];
}) {
  const width = 270;
  const height = 75;

  const points = useMemo(() => {
    if (history.length < 2) return null;
    const n = history.length;
    const dx = width / (n - 1);

    const speedCoords: string[] = [];
    const throttleCoords: string[] = [];
    const brakeBlocks: { x: number; w: number }[] = [];

    let currentBrakeStart: number | null = null;

    history.forEach((pt, i) => {
      const x = i * dx;

      // Speed (0 to 360 km/h) -> mapped to height
      const ySpeed = height - (Math.min(360, Math.max(0, pt.speed)) / 360) * (height - 8) - 4;
      speedCoords.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ySpeed.toFixed(1)}`);

      // Throttle (0 to 100%) -> mapped to bottom 50%
      const yThrottle = height - (Math.min(100, Math.max(0, pt.throttle)) / 100) * (height * 0.45) - 3;
      throttleCoords.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${yThrottle.toFixed(1)}`);

      // Brake blocks
      if (pt.brake) {
        if (currentBrakeStart === null) currentBrakeStart = x;
      } else {
        if (currentBrakeStart !== null) {
          brakeBlocks.push({ x: currentBrakeStart, w: Math.max(dx, x - currentBrakeStart) });
          currentBrakeStart = null;
        }
      }
    });

    if (currentBrakeStart !== null) {
      brakeBlocks.push({ x: currentBrakeStart, w: Math.max(dx, width - currentBrakeStart) });
    }

    return {
      speedPath: speedCoords.join(" "),
      throttlePath: throttleCoords.join(" "),
      brakeBlocks,
      lastPt: history[history.length - 1],
    };
  }, [history]);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-pitwall-surface/60 p-2.5">
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-pitwall-text-muted">
        <span className="flex items-center gap-1 font-bold text-pitwall-text">
          <Activity className="h-3 w-3 text-pitwall-telemetry" />
          ROLLING TELEMETRY TRACES
        </span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-pitwall-telemetry" />
            <span className="text-pitwall-telemetry">SPD</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-pitwall-drs" />
            <span className="text-pitwall-drs">THR</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-pitwall-signal" />
            <span className="text-pitwall-signal">BRK</span>
          </span>
        </div>
      </div>

      <div className="relative h-[75px] w-full bg-pitwall-canvas rounded overflow-hidden">
        {/* Horizontal reference grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-1 opacity-20">
          <div className="w-full border-b border-pitwall-hairline" />
          <div className="w-full border-b border-pitwall-hairline border-dashed" />
          <div className="w-full border-b border-pitwall-hairline" />
        </div>

        {points ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
            {/* Brake binary active regions */}
            {points.brakeBlocks.map((b, idx) => (
              <rect
                key={idx}
                x={b.x}
                y={height - 6}
                width={b.w}
                height={5}
                fill="#E10600"
                opacity={0.8}
              />
            ))}

            {/* Throttle trace */}
            <path
              d={points.throttlePath}
              fill="none"
              stroke="#37D67A"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />

            {/* Speed trace */}
            <path
              d={points.speedPath}
              fill="none"
              stroke="#00C8E8"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Real-time Cursor Node */}
            <circle
              cx={width - 2}
              cy={height - (Math.min(360, Math.max(0, points.lastPt.speed)) / 360) * (height - 8) - 4}
              r={3}
              fill="#00C8E8"
              stroke="#FFFFFF"
              strokeWidth={1}
            />
          </svg>
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[9px] text-pitwall-text-muted">
            ACCUMULATING TELEMETRY BUFFER...
          </div>
        )}
      </div>

      <div className="flex items-center justify-between font-mono text-[8px] text-pitwall-text-muted">
        <span>0 km/h</span>
        <span>BUFFER: {history.length} FRAMES</span>
        <span>360 km/h</span>
      </div>
    </div>
  );
});

/**
 * Disabled/Unavailable Telemetry Channel Chip.
 */
const UnavailableChip = memo(function UnavailableChip({ label }: { label: string }) {
  return (
    <span
      className="flex items-center gap-1 rounded bg-pitwall-surface/80 px-2 py-0.5 font-mono text-[9px] text-pitwall-text-muted/60"
      title={`${label} is not exposed by the current FastF1 telemetry stream`}
    >
      <Lock className="h-2.5 w-2.5" />
      <span>{label}</span>
      <span className="font-bold text-pitwall-text-muted/40">N/A</span>
    </span>
  );
});

interface TyreHistoryEntry {
  compound: string;
  tyreStartLap: number;
}

/**
 * Estimates laps on the current tyre compound from observed replay frame transitions.
 */
function useTyreAge(driverId: string | null, compound: string | undefined, lap: number | undefined) {
  const historyRef = useRef<Map<string, TyreHistoryEntry>>(new Map());

  return useMemo(() => {
    if (!driverId || compound === undefined || lap === undefined) {
      return null;
    }
    const history = historyRef.current;
    let entry = history.get(driverId);
    if (!entry || entry.compound !== compound) {
      entry = { compound, tyreStartLap: lap };
      history.set(driverId, entry);
    }
    return Math.max(1, lap - entry.tyreStartLap + 1);
  }, [driverId, compound, lap]);
}

interface TelemetryPanelProps {
  onCollapse?: () => void;
}

export function TelemetryPanel({ onCollapse }: TelemetryPanelProps) {
  const currentFrame = useReplayStore((s) => s.currentFrame);
  const frames = useReplayStore((s) => s.frames);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);
  const followedDriver = useReplayStore((s) => s.followedDriver);
  const setFollowedDriver = useReplayStore((s) => s.setFollowedDriver);
  const metadata = useReplayStore((s) => s.metadata);
  const pixiControls = useReplayStore((s) => s.pixiControls);

  const driverFrame = useMemo(
    () => currentFrame?.drivers.find((d) => d.driverId === selectedDriver) ?? null,
    [currentFrame, selectedDriver]
  );

  const driverMeta = useMemo(
    () => metadata?.drivers.find((d) => d.abbreviation === selectedDriver) ?? null,
    [metadata, selectedDriver]
  );

  const tyreAge = useTyreAge(selectedDriver, driverFrame?.tyre, driverFrame?.lap);

  // Peak speed derived from real historical frames for this driver
  const peakSpeed = useMemo(() => {
    if (!selectedDriver) return 0;
    let max = driverFrame?.speed ?? 0;
    for (const f of frames) {
      const d = f.drivers.find((dr) => dr.driverId === selectedDriver);
      if (d && d.speed > max) {
        max = d.speed;
      }
    }
    return Math.round(max);
  }, [frames, selectedDriver, driverFrame]);

  // Rolling synchronized telemetry traces
  const traceHistory = useMemo(() => {
    if (!selectedDriver || !frames.length) {
      if (driverFrame) {
        return [{ speed: driverFrame.speed, throttle: driverFrame.throttle, brake: driverFrame.brake }];
      }
      return [];
    }
    const pts: { speed: number; throttle: number; brake: boolean }[] = [];
    for (const f of frames) {
      const d = f.drivers.find((dr) => dr.driverId === selectedDriver);
      if (d) {
        pts.push({
          speed: d.speed,
          throttle: d.throttle,
          brake: d.brake,
        });
      }
    }
    return pts;
  }, [frames, selectedDriver, driverFrame]);

  const teamColor = driverMeta?.teamColor || "#00C8E8";
  const compoundStyle = COMPOUND_COLORS[driverFrame?.tyre ?? "UNKNOWN"] ?? COMPOUND_COLORS.UNKNOWN;

  return (
    <div className="flex flex-col h-full bg-pitwall-dock overflow-hidden select-none">
      {/* Dock Header Deck */}
      <div className="flex items-center justify-between border-b border-pitwall-hairline bg-pitwall-surface/60 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-pitwall-telemetry" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-pitwall-text">
            TELEMETRY DECK
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {selectedDriver && (
            <button
              onClick={() => {
                if (followedDriver === selectedDriver) {
                  setFollowedDriver(null);
                  pixiControls?.stopFollowing();
                  pixiControls?.resetView();
                } else {
                  setFollowedDriver(selectedDriver);
                  pixiControls?.followDriver(selectedDriver);
                }
              }}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors",
                followedDriver === selectedDriver
                  ? "bg-pitwall-telemetry/20 text-pitwall-telemetry border border-pitwall-telemetry/40"
                  : "bg-pitwall-elevated text-pitwall-text-muted hover:text-white"
              )}
              title={
                followedDriver === selectedDriver
                  ? `Stop camera-following ${selectedDriver}`
                  : `Lock camera follow onto ${selectedDriver}`
              }
              aria-label={followedDriver === selectedDriver ? `Stop following ${selectedDriver}` : `Follow ${selectedDriver}`}
            >
              <Crosshair className="h-3 w-3" />
              {followedDriver === selectedDriver ? "FOLLOWING" : "FOLLOW"}
            </button>
          )}

          {onCollapse && (
            <button
              onClick={onCollapse}
              className="rounded p-1 text-pitwall-text-muted hover:bg-pitwall-elevated hover:text-white transition-colors"
              title="Collapse sidebar"
              aria-label="Collapse telemetry sidebar"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2.5 flex flex-col gap-3">
        {/* Empty State when no driver is selected */}
        {!selectedDriver && (
          <div className="flex flex-col items-center justify-center gap-2.5 rounded-lg bg-pitwall-surface/40 p-6 text-center my-auto">
            <ShieldAlert className="h-7 w-7 text-pitwall-text-muted/40" />
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-pitwall-text">
              NO DRIVER SELECTED
            </p>
            <p className="font-mono text-[10px] text-pitwall-text-muted leading-relaxed">
              Click any driver on the timing ladder to inspect synchronized telemetry instruments.
            </p>
          </div>
        )}

        {/* Driver Telemetry Data View */}
        <AnimatePresence initial={false}>
          {selectedDriver && driverFrame && (
            <motion.div
              key={selectedDriver}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex flex-col gap-3"
            >
              {/* Driver Identity Strip */}
              <div className="flex items-center justify-between rounded-lg bg-pitwall-surface/60 p-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-8 w-1.5 rounded-full"
                    style={{ backgroundColor: teamColor }}
                  />
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-lg font-black tracking-wide text-pitwall-text">
                        {selectedDriver}
                      </span>
                      <span className="font-mono text-[10px] text-pitwall-text-muted font-bold">
                        #{driverMeta?.driverNumber ?? "—"}
                      </span>
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-pitwall-text-muted truncate max-w-[140px]">
                      {driverMeta?.teamName ?? "FORMULA 1"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-pitwall-elevated px-2 py-0.5 font-mono text-xs font-bold text-pitwall-text">
                    P{driverFrame.position}
                  </span>
                  <span className="rounded bg-pitwall-elevated px-2 py-0.5 font-mono text-[10px] text-pitwall-text-muted">
                    L{driverFrame.lap}
                  </span>
                </div>
              </div>

              {/* Formula 1 Shift Lights Rev Bar */}
              <RevLimiterBar rpm={driverFrame.rpm} />

              {/* Core Instrument Cluster: Speed, Gear & DRS, RPM */}
              <div className="grid grid-cols-3 items-center rounded-lg bg-pitwall-surface/60 p-1.5">
                <SpeedDial speed={driverFrame.speed} peakSpeed={peakSpeed} />
                <GearCenterBlock gear={driverFrame.gear} drs={driverFrame.drs} />
                <RpmDial rpm={driverFrame.rpm} />
              </div>

              {/* Linear Control Inputs (Throttle & Honest Binary Brake) */}
              <ControlInputs throttle={driverFrame.throttle} brake={driverFrame.brake} />

              {/* Tyre & Sector Status Row */}
              <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                {/* Tyre Compound Badge */}
                <div className="flex items-center justify-between rounded-lg bg-pitwall-surface/60 px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-black/40"
                      style={{ backgroundColor: compoundStyle.bg }}
                    />
                    <span className="font-bold text-pitwall-text">{driverFrame.tyre}</span>
                  </div>
                  <span className="text-pitwall-text-muted font-semibold">
                    {tyreAge !== null ? `${tyreAge}L est.` : "N/A"}
                  </span>
                </div>

                {/* Active Sector Indicators */}
                <div className="flex items-center justify-between rounded-lg bg-pitwall-surface/60 px-2.5 py-2">
                  <span className="text-pitwall-text-muted">SECTOR</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((s) => (
                      <span
                        key={s}
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold transition-colors",
                          s === driverFrame.sector
                            ? "bg-amber-400 text-black shadow-xs"
                            : "bg-pitwall-elevated/70 text-pitwall-text-muted/60"
                        )}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Synchronized Real Rolling Telemetry Traces */}
              <SynchronizedTraces history={traceHistory} />

              {/* Unavailable Systems & Pipeline Transparency */}
              <div className="flex flex-col gap-1.5 rounded-lg bg-pitwall-surface/40 p-2">
                <div className="flex items-center justify-between font-mono text-[9px] text-pitwall-text-muted">
                  <span>UNSUPPORTED CHANNELS</span>
                  <span className="text-pitwall-text-muted/60 text-[8px]">PIPELINE BOUNDARY</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <UnavailableChip label="ERS" />
                  <UnavailableChip label="PIT LIMITER" />
                  <UnavailableChip label="TYRE WEAR" />
                  <UnavailableChip label="G-FORCE" />
                </div>
              </div>

              {/* Technical Honesty Footnote */}
              <p className="font-mono text-[8px] leading-tight text-pitwall-text-muted/50 px-1 pb-1">
                DATA HONESTY: Speed, RPM, Gear, Throttle, Brake (binary), DRS, and Tyre compound are real FastF1 stream data. Tyre age is client-estimated (est.). ERS, temperatures, and G-force are unavailable in pipeline.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
