"use client";

import React from "react";
import Link from "next/link";
import { Play, Compass, Activity, Radio, Cpu, ChevronRight, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LandingHeroProps {
  onExploreClick?: () => void;
}

export function LandingHero({ onExploreClick }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden py-12 md:py-20 lg:py-24" aria-label="Hero">
      {/* Decorative background grid and gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,#18212A_1px,transparent_1px),linear-gradient(to_bottom,#18212A_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-pitwall-signal/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-20 -z-10 h-72 w-72 rounded-full bg-pitwall-telemetry/10 blur-[100px]" />

      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        {/* Status Pill */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-pitwall-hairline bg-pitwall-surface/80 px-3.5 py-1 text-xs font-mono text-pitwall-text-muted shadow-sm backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-pitwall-telemetry" />
          <span className="text-pitwall-text font-semibold">INTERACTIVE RACE REPLAY</span>
          <span className="text-pitwall-hairline">|</span>
          <span className="text-pitwall-telemetry font-mono">TIMING & TELEMETRY WORKBENCH</span>
        </div>

        {/* Main Headline */}
        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
          Formula 1 Race Replay
          <span className="block bg-gradient-to-r from-pitwall-signal via-rose-500 to-amber-500 bg-clip-text text-transparent">
            Reimagined for Spectators
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-base text-pitwall-text-muted sm:text-lg md:text-xl leading-relaxed">
          Relive completed Grand Prix sessions with synchronized 2D circuit visualization, timing towers, driver telemetry traces, and race replay transport controls.
        </p>

        {/* Primary Call to Actions */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto h-12 px-7 bg-pitwall-signal hover:bg-pitwall-signal/90 text-white font-semibold shadow-lg shadow-pitwall-signal/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Link href="/replay/demo" className="flex items-center gap-2">
              <Play className="h-4 w-4 fill-white" />
              <span>Watch Instant Demo</span>
              <span className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/90">
                Sample
              </span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onExploreClick}
            className="w-full sm:w-auto h-12 px-6 border-pitwall-hairline bg-pitwall-surface/60 hover:bg-pitwall-surface text-pitwall-text font-medium backdrop-blur-sm transition-all"
          >
            <Compass className="mr-2 h-4 w-4 text-pitwall-telemetry" />
            <span>Explore Races & Seasons</span>
            <ChevronRight className="ml-1 h-3.5 w-3.5 text-pitwall-text-muted" />
          </Button>
        </div>

        {/* Feature highlights */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-lg border border-pitwall-hairline/80 bg-pitwall-dock/60 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-1.5 text-pitwall-telemetry">
              <Activity className="h-4 w-4" />
              <span className="font-mono text-sm font-bold">2 Hz Replay</span>
            </div>
            <div className="mt-1 text-[11px] text-pitwall-text-muted">
              Interpolated car frames
            </div>
          </div>

          <div className="rounded-lg border border-pitwall-hairline/80 bg-pitwall-dock/60 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-1.5 text-pitwall-drs">
              <Radio className="h-4 w-4" />
              <span className="font-mono text-sm font-bold">Timing Tower</span>
            </div>
            <div className="mt-1 text-[11px] text-pitwall-text-muted">
              Full classification order
            </div>
          </div>

          <div className="rounded-lg border border-pitwall-hairline/80 bg-pitwall-dock/60 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-1.5 text-amber-400">
              <Cpu className="h-4 w-4" />
              <span className="font-mono text-sm font-bold">WebGL Canvas</span>
            </div>
            <div className="mt-1 text-[11px] text-pitwall-text-muted">
              Hardware accelerated
            </div>
          </div>

          <div className="rounded-lg border border-pitwall-hairline/80 bg-pitwall-dock/60 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-1.5 text-rose-400">
              <Archive className="h-4 w-4" />
              <span className="font-mono text-sm font-bold">2018–Present</span>
            </div>
            <div className="mt-1 text-[11px] text-pitwall-text-muted">
              Season archive lookup
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
