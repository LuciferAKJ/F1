"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Gauge as GaugeIcon, Lock } from "lucide-react";
import { useReplayStore } from "@/store/replayStore";
import { cn } from "@/lib/utils";

/**
 * F1 TV-style telemetry dashboard for the selected driver.
 *
 * Data honesty note: speed/RPM/gear/throttle/DRS/lap/sector/position/tyre
 * compound come straight from the replay frame. Brake is a boolean in the
 * pipeline (not a graduated %), so the brake bar is genuinely binary
 * (0%/100%) rather than a fabricated intensity curve. ERS deployment, tyre
 * life/age-as-telemetry, and pit-limiter status are NOT in the current
 * telemetry pipeline at all — those three render as disabled "N/A" badges
 * rather than invented numbers. Tyre age shown here is a client-side
 * estimate (laps since last observed compound change), labeled "est.".
 */

const RPM_MAX = 12000; // assumed gauge scale for visualization only — not a claimed hardware limit
const SPEED_MAX = 360;

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#DA291C", MEDIUM: "#FFD12E", HARD: "#F0F0F0",
  INTERMEDIATE: "#43B02A", WET: "#0067AD", UNKNOWN: "#888888",
};

function isDrsOpen(drs: number): boolean {
  return drs === 10 || drs === 12 || drs === 14;
}

/** Smoothly animates a target number via a spring, exposing both the live
 * motion value (for gauges) and a rounded display value (for text) so
 * numeric readouts interpolate instead of jumping between replay frames. */
function useAnimatedNumber(target: number, config = { stiffness: 120, damping: 20 }) {
  const motionVal = useMotionValue(target);
  const spring = useSpring(motionVal, config);
  const [display, setDisplay] = useState(Math.round(target));

  useEffect(() => {
    motionVal.set(target);
  }, [target, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return unsub;
  }, [spring]);

  return { spring, display };
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Arc gauge: sweeps from `startAngle` to `endAngle` (degrees) proportional to value/max. */
function arcPath(startAngle: number, endAngle: number, r: number, cx: number, cy: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

const START_ANGLE = -130;
const END_ANGLE = 130;
const SWEEP = END_ANGLE - START_ANGLE;

const SpeedGauge = memo(function SpeedGauge({ speed }: { speed: number }) {
  const { spring, display } = useAnimatedNumber(speed);
  const angle = useTransform(spring, (v) => START_ANGLE + (Math.min(v, SPEED_MAX) / SPEED_MAX) * SWEEP);
  const path = useTransform(angle, (a) => arcPath(START_ANGLE, a, 46, 60, 60));
  const track = arcPath(START_ANGLE, END_ANGLE, 46, 60, 60);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 90" className="h-24 w-32">
        <path d={track} stroke="#2a2a2a" strokeWidth={8} fill="none" strokeLinecap="round" />
        <motion.path d={path} stroke="#DA291C" strokeWidth={8} fill="none" strokeLinecap="round" />
      </svg>
      <div className="-mt-8 flex flex-col items-center">
        <span className="text-2xl font-bold tabular-nums">{display}</span>
        <span className="text-[10px] text-muted">km/h</span>
      </div>
    </div>
  );
});

const RpmGauge = memo(function RpmGauge({ rpm }: { rpm: number }) {
  const { spring, display } = useAnimatedNumber(rpm, { stiffness: 160, damping: 22 });
  const angle = useTransform(spring, (v) => START_ANGLE + (Math.min(v, RPM_MAX) / RPM_MAX) * SWEEP);
  const path = useTransform(angle, (a) => arcPath(START_ANGLE, a, 34, 44, 44));
  const track = arcPath(START_ANGLE, END_ANGLE, 34, 44, 44);
  const redline = rpm / RPM_MAX > 0.88;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 88 66" className="h-16 w-20">
        <path d={track} stroke="#2a2a2a" strokeWidth={6} fill="none" strokeLinecap="round" />
        <motion.path
          d={path}
          stroke={redline ? "#ff3b3b" : "#00c2ff"}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <div className="-mt-5 flex flex-col items-center">
        <span className="text-sm font-bold tabular-nums">{display}</span>
        <span className="text-[9px] text-muted">RPM</span>
      </div>
    </div>
  );
});

const GearIndicator = memo(function GearIndicator({ gear }: { gear: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-black/40 px-4 py-2">
      <motion.span
        key={gear}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="text-3xl font-black leading-none"
      >
        {gear === 0 ? "N" : gear}
      </motion.span>
      <span className="mt-1 text-[9px] text-muted">GEAR</span>
    </div>
  );
});

const BarMeter = memo(function BarMeter({
  value, label, color,
}: { value: number; label: string; color: string }) {
  const { spring, display } = useAnimatedNumber(value, { stiffness: 200, damping: 26 });
  const width = useTransform(spring, (v) => `${Math.max(0, Math.min(100, v))}%`);

  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[10px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{display}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/40">
        <motion.div className="h-full rounded-full" style={{ width, backgroundColor: color }} />
      </div>
    </div>
  );
});

const DrsPill = memo(function DrsPill({ drs }: { drs: number }) {
  const open = isDrsOpen(drs);
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-bold transition-colors",
        open ? "bg-green-500 text-black" : "bg-black/40 text-muted"
      )}
    >
      DRS {open ? "OPEN" : "CLOSED"}
    </span>
  );
});

const UnavailableBadge = memo(function UnavailableBadge({ label }: { label: string }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-black/20 px-3 py-1 text-xs text-muted/50"
      title={`${label} is not exposed by the current telemetry pipeline`}
    >
      <Lock className="h-3 w-3" /> {label} N/A
    </span>
  );
});

interface TyreHistoryEntry {
  compound: string;
  tyreStartLap: number;
}

/** Estimates laps-on-current-tyre client-side from observed compound/lap changes (not a real telemetry field). */
function useTyreAge(driverId: string | null, compound: string | undefined, lap: number | undefined) {
  const historyRef = useRef<Map<string, TyreHistoryEntry>>(new Map());
  const [age, setAge] = useState<number | null>(null);

  useEffect(() => {
    if (!driverId || compound === undefined || lap === undefined) {
      setAge(null);
      return;
    }
    const history = historyRef.current;
    let entry = history.get(driverId);
    if (!entry || entry.compound !== compound) {
      entry = { compound, tyreStartLap: lap };
      history.set(driverId, entry);
    }
    setAge(lap - entry.tyreStartLap + 1);
  }, [driverId, compound, lap]);

  return age;
}

export function TelemetryPanel() {
  const currentFrame = useReplayStore((s) => s.currentFrame);
  const selectedDriver = useReplayStore((s) => s.selectedDriver);

  const driverFrame = useMemo(
    () => currentFrame?.drivers.find((d) => d.driverId === selectedDriver) ?? null,
    [currentFrame, selectedDriver]
  );

  const tyreAge = useTyreAge(selectedDriver, driverFrame?.tyre, driverFrame?.lap);

  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <GaugeIcon className="h-3.5 w-3.5 text-accent" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
          Telemetry {selectedDriver ? `— ${selectedDriver}` : ""}
        </h3>
      </div>

      {!driverFrame && <p className="text-xs text-muted">Select a driver to see telemetry.</p>}

      <AnimatePresence mode="wait">
        {driverFrame && (
          <motion.div
            key={selectedDriver}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-around">
              <SpeedGauge speed={driverFrame.speed} />
              <div className="flex flex-col items-center gap-2">
                <RpmGauge rpm={driverFrame.rpm} />
                <GearIndicator gear={driverFrame.gear} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <BarMeter value={driverFrame.throttle} label="Throttle" color="#43B02A" />
              <BarMeter value={driverFrame.brake ? 100 : 0} label="Brake" color="#DA291C" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DrsPill drs={driverFrame.drs} />

              <span
                className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: `${COMPOUND_COLORS[driverFrame.tyre] ?? "#888888"}22` }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-black/40"
                  style={{ backgroundColor: COMPOUND_COLORS[driverFrame.tyre] ?? "#888888" }}
                />
                {driverFrame.tyre}
                {tyreAge !== null && <span className="text-muted"> · {tyreAge}L est.</span>}
              </span>

              <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-bold">
                LAP {driverFrame.lap}
              </span>

              <span className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 text-xs font-bold">
                {[1, 2, 3].map((s) => (
                  <span
                    key={s}
                    className={cn("h-1.5 w-1.5 rounded-full", s === driverFrame.sector ? "bg-amber-400" : "bg-white/20")}
                  />
                ))}
                S{driverFrame.sector}
              </span>

              <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">
                P{driverFrame.position}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
              <UnavailableBadge label="ERS" />
              <UnavailableBadge label="Pit Limiter" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
