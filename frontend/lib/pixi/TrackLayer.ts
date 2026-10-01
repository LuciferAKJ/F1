import { Container, Graphics } from "pixi.js";
import type { CircuitData } from "@/types/replay";

/**
 * Draws the circuit: base outline, a stylized racing-line overlay, a start/finish
 * line, and approximate sector-boundary markers. Also exposes world<->track
 * coordinate transforms used by cars and the camera.
 *
 * Note: FastF1's circuit map here is derived from one fastest-lap X/Y trace, with
 * no separate pit-lane polyline or DRS-zone ranges in the data we receive — so
 * those two are intentionally not drawn rather than faked. Sector markers are an
 * approximation (equal arc-length thirds) since per-point sector tags aren't part
 * of CircuitData; wire real Sector1/2Time distance boundaries through the API to
 * replace this with an exact split.
 */
export class TrackLayer {
  readonly container: Container;
  private baseGraphics: Graphics;
  private lineGraphics: Graphics;
  private markerGraphics: Graphics;
  private circuit: CircuitData;
  private padding = 60;
  private localPoints: { x: number; y: number }[] = [];
  private cumulativeDist: number[] = [];

  constructor(circuit: CircuitData) {
    this.circuit = circuit;
    this.container = new Container();
    this.baseGraphics = new Graphics();
    this.lineGraphics = new Graphics();
    this.markerGraphics = new Graphics();
    this.container.addChild(this.baseGraphics, this.lineGraphics, this.markerGraphics);

    this.buildLocalPoints();
    this.drawBase();
    this.drawRacingLine();
    this.drawStartFinishLine();
    this.drawSectorMarkers();
  }

  private buildLocalPoints(): void {
    const { x, y } = this.circuit;
    this.localPoints = x.map((xi, i) => ({ x: this.toLocalX(xi), y: this.toLocalY(y[i]) }));

    let dist = 0;
    this.cumulativeDist = [0];
    for (let i = 1; i < this.localPoints.length; i++) {
      const a = this.localPoints[i - 1];
      const b = this.localPoints[i];
      dist += Math.hypot(b.x - a.x, b.y - a.y);
      this.cumulativeDist.push(dist);
    }
  }

  private get totalDistance(): number {
    return this.cumulativeDist[this.cumulativeDist.length - 1] ?? 0;
  }

  /** Index into localPoints nearest a given fraction (0..1) of total arc length. */
  private indexAtFraction(fraction: number): number {
    const target = fraction * this.totalDistance;
    let lo = 0, hi = this.cumulativeDist.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cumulativeDist[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private drawBase(): void {
    const pts = this.localPoints;
    if (pts.length < 2) return;
    const g = this.baseGraphics;

    // Track bed (wide, dark)
    g.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
    g.stroke({ width: 26, color: 0x1c1c1c, cap: "round", join: "round" });

    // Track surface
    g.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
    g.stroke({ width: 20, color: 0x333333, cap: "round", join: "round" });

    // Edge line (kerb-ish contrast)
    g.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
    g.stroke({ width: 21, color: 0x555555, cap: "round", join: "round", alpha: 0.25 });
  }

  private drawRacingLine(): void {
    const pts = this.localPoints;
    if (pts.length < 2) return;
    const g = this.lineGraphics;
    g.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
    g.stroke({ width: 2, color: 0xffd12e, cap: "round", join: "round", alpha: 0.55 });
  }

  private drawStartFinishLine(): void {
    const pts = this.localPoints;
    if (pts.length < 2) return;
    const p0 = pts[0];
    const p1 = pts[1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular unit vector, scaled to track width.
    const perpX = (-dy / len) * 14;
    const perpY = (dx / len) * 14;

    const g = this.markerGraphics;
    g.moveTo(p0.x - perpX, p0.y - perpY);
    g.lineTo(p0.x + perpX, p0.y + perpY);
    g.stroke({ width: 4, color: 0xffffff, cap: "square" });
  }

  private drawSectorMarkers(): void {
    const g = this.markerGraphics;
    const fractions = [1 / 3, 2 / 3];
    const colors = [0x00c2ff, 0x00c2ff];

    fractions.forEach((frac, i) => {
      const idx = this.indexAtFraction(frac);
      const p = this.localPoints[idx];
      const next = this.localPoints[Math.min(idx + 1, this.localPoints.length - 1)];
      if (!p || !next) return;
      const dx = next.x - p.x;
      const dy = next.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const perpX = (-dy / len) * 12;
      const perpY = (dx / len) * 12;

      g.moveTo(p.x - perpX, p.y - perpY);
      g.lineTo(p.x + perpX, p.y + perpY);
      g.stroke({ width: 3, color: colors[i], cap: "square", alpha: 0.9 });
    });
  }

  /** Convert raw GPS X to local (unscaled) track-space X. */
  toLocalX(x: number): number {
    return x - this.circuit.minX - (this.circuit.maxX - this.circuit.minX) / 2;
  }

  toLocalY(y: number): number {
    // Flip Y since screen space grows downward while GPS Y grows "up".
    return -(y - this.circuit.minY - (this.circuit.maxY - this.circuit.minY) / 2);
  }

  get worldWidth(): number {
    return this.circuit.maxX - this.circuit.minX + this.padding * 2;
  }

  get worldHeight(): number {
    return this.circuit.maxY - this.circuit.minY + this.padding * 2;
  }
}
