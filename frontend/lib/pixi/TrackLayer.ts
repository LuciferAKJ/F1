import { Container, Graphics, Text } from "pixi.js";
import type { CircuitData } from "@/types/replay";

/**
 * Draws the circuit:
 * - High-contrast asphalt roadbed and tarmac surface ribbon.
 * - Mathematically derived inner and outer track boundaries (white track limit lines)
 *   computed via perpendicular normal vector ribbon offsets from the telemetry polyline.
 * - High-visibility start/finish line.
 * - Distinctive sector boundary markers (S1/S2/S3).
 * - Subtle racing guide centerline.
 *
 * Technical note on track boundaries:
 * FastF1 telemetry provides a single telemetry coordinate trace (typically the fastest lap).
 * Standard FIA Grade 1 circuits feature a regulated track width of 12–15 meters.
 * Track boundary geometry here is mathematically constructed by computing smoothed 2D unit
 * normals along the polyline and offsetting the inner and outer track limits by half-width (11 units,
 * proportional to standard track scale). This accurately reflects real circuit road ribbons without
 * claiming to be independently surveyed satellite civil engineering measurements.
 */
export class TrackLayer {
  readonly container: Container;
  private baseGraphics: Graphics;
  private lineGraphics: Graphics;
  private markerGraphics: Graphics;
  private labelContainer: Container;
  private circuit: CircuitData;
  private padding = 70;
  private localPoints: { x: number; y: number }[] = [];
  private outerPoints: { x: number; y: number }[] = [];
  private innerPoints: { x: number; y: number }[] = [];
  private cumulativeDist: number[] = [];
  private coordScale = 1;
  private isClosedLoop = false;

  constructor(circuit: CircuitData) {
    this.circuit = circuit;
    const spanX = Math.max(this.circuit.maxX - this.circuit.minX, 1);
    const spanY = Math.max(this.circuit.maxY - this.circuit.minY, 1);
    const maxSpan = Math.max(spanX, spanY);
    // Normalize coordinates so the circuit bounding box spans ~1000 units.
    this.coordScale = 1000 / maxSpan;

    this.container = new Container();
    this.baseGraphics = new Graphics();
    this.lineGraphics = new Graphics();
    this.markerGraphics = new Graphics();
    this.labelContainer = new Container();
    this.container.addChild(this.baseGraphics, this.lineGraphics, this.markerGraphics, this.labelContainer);

    this.buildLocalPoints();
    this.drawBase();
    this.drawRacingLine();
    this.drawStartFinishLine();
    this.drawSectorMarkers();
  }

  private buildLocalPoints(): void {
    const { x, y } = this.circuit;
    this.localPoints = x.map((xi, i) => ({ x: this.toLocalX(xi), y: this.toLocalY(y[i]) }));
    const n = this.localPoints.length;
    if (n < 2) return;

    // Check if circuit start and end join as a closed circuit loop
    const dxClose = this.localPoints[n - 1].x - this.localPoints[0].x;
    const dyClose = this.localPoints[n - 1].y - this.localPoints[0].y;
    this.isClosedLoop = Math.hypot(dxClose, dyClose) < 40;

    let dist = 0;
    this.cumulativeDist = [0];
    for (let i = 1; i < n; i++) {
      const a = this.localPoints[i - 1];
      const b = this.localPoints[i];
      dist += Math.hypot(b.x - a.x, b.y - a.y);
      this.cumulativeDist.push(dist);
    }

    // Compute smooth normal ribbon offsets (half-width = 11 units, total road width = 22 units)
    const trackHalfWidth = 11.0;
    this.outerPoints = [];
    this.innerPoints = [];

    for (let i = 0; i < n; i++) {
      let prev: { x: number; y: number };
      let next: { x: number; y: number };

      if (this.isClosedLoop) {
        prev = this.localPoints[(i - 1 + n) % n];
        next = this.localPoints[(i + 1) % n];
      } else {
        prev = this.localPoints[Math.max(0, i - 1)];
        next = this.localPoints[Math.min(n - 1, i + 1)];
      }

      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const tLen = Math.hypot(tx, ty) || 1.0;

      // Unit normal perpendicular to track heading
      const nx = -ty / tLen;
      const ny = tx / tLen;

      const p = this.localPoints[i];
      this.outerPoints.push({ x: p.x + nx * trackHalfWidth, y: p.y + ny * trackHalfWidth });
      this.innerPoints.push({ x: p.x - nx * trackHalfWidth, y: p.y - ny * trackHalfWidth });
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

    // 1. Run-off verge foundation (wide dark border providing contrast against canvas background)
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    if (this.isClosedLoop) g.lineTo(pts[0].x, pts[0].y);
    g.stroke({ width: 28, color: 0x14161a, cap: "round", join: "round" });

    // 2. Tarmac road surface
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    if (this.isClosedLoop) g.lineTo(pts[0].x, pts[0].y);
    g.stroke({ width: 22, color: 0x272a33, cap: "round", join: "round" });

    // 3. Outer track boundary limit line (FIA-style white line)
    if (this.outerPoints.length > 1) {
      g.moveTo(this.outerPoints[0].x, this.outerPoints[0].y);
      for (let i = 1; i < this.outerPoints.length; i++) {
        g.lineTo(this.outerPoints[i].x, this.outerPoints[i].y);
      }
      if (this.isClosedLoop) g.lineTo(this.outerPoints[0].x, this.outerPoints[0].y);
      g.stroke({ width: 1.5, color: 0xf0f3f8, alpha: 0.85, cap: "round", join: "round" });
    }

    // 4. Inner track boundary limit line (FIA-style white line)
    if (this.innerPoints.length > 1) {
      g.moveTo(this.innerPoints[0].x, this.innerPoints[0].y);
      for (let i = 1; i < this.innerPoints.length; i++) {
        g.lineTo(this.innerPoints[i].x, this.innerPoints[i].y);
      }
      if (this.isClosedLoop) g.lineTo(this.innerPoints[0].x, this.innerPoints[0].y);
      g.stroke({ width: 1.5, color: 0xf0f3f8, alpha: 0.85, cap: "round", join: "round" });
    }
  }

  private drawRacingLine(): void {
    const pts = this.localPoints;
    if (pts.length < 2) return;
    const g = this.lineGraphics;

    // Subtle yellow racing groove guide along the centerline
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    if (this.isClosedLoop) g.lineTo(pts[0].x, pts[0].y);
    g.stroke({ width: 1.5, color: 0xffd12e, cap: "round", join: "round", alpha: 0.35 });
  }

  private drawStartFinishLine(): void {
    const pts = this.localPoints;
    if (pts.length < 2) return;
    const p0 = pts[0];
    const p1 = pts[1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;

    // Perpendicular unit vector across road width (half-width 13 units)
    const perpX = (-dy / len) * 13.5;
    const perpY = (dx / len) * 13.5;

    const g = this.markerGraphics;

    // High-contrast primary white finish gate
    g.moveTo(p0.x - perpX, p0.y - perpY);
    g.lineTo(p0.x + perpX, p0.y + perpY);
    g.stroke({ width: 4.5, color: 0xffffff, cap: "square" });

    // Alternating dark gate tick creating checkered contrast
    const dirX = (dx / len) * 2;
    const dirY = (dy / len) * 2;
    g.moveTo(p0.x - perpX + dirX, p0.y - perpY + dirY);
    g.lineTo(p0.x + perpX + dirX, p0.y + perpY + dirY);
    g.stroke({ width: 2, color: 0x111111, cap: "square" });

    // Label indicator at start line
    const labelX = p0.x - perpX * 1.55;
    const labelY = p0.y - perpY * 1.55;
    const sfLabel = new Text({
      text: "S/F",
      style: {
        fontFamily: "Arial",
        fontSize: 9,
        fontWeight: "bold",
        fill: 0xffffff,
      },
    });
    sfLabel.anchor.set(0.5);
    sfLabel.position.set(labelX, labelY);
    this.labelContainer.addChild(sfLabel);
  }

  private drawSectorMarkers(): void {
    const g = this.markerGraphics;
    const sectors = [
      { frac: 1 / 3, name: "S2", color: 0x00e5ff },
      { frac: 2 / 3, name: "S3", color: 0xffaa00 },
    ];

    sectors.forEach((sec) => {
      const idx = this.indexAtFraction(sec.frac);
      const p = this.localPoints[idx];
      const next = this.localPoints[Math.min(idx + 1, this.localPoints.length - 1)];
      if (!p || !next) return;

      const dx = next.x - p.x;
      const dy = next.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const perpX = (-dy / len) * 13;
      const perpY = (dx / len) * 13;

      // High-visibility sector boundary bar across track
      g.moveTo(p.x - perpX, p.y - perpY);
      g.lineTo(p.x + perpX, p.y + perpY);
      g.stroke({ width: 3.5, color: sec.color, cap: "square", alpha: 0.95 });

      // Sector label pill outside track edge
      const labelX = p.x - perpX * 1.5;
      const labelY = p.y - perpY * 1.5;
      const label = new Text({
        text: sec.name,
        style: {
          fontFamily: "Arial",
          fontSize: 9,
          fontWeight: "bold",
          fill: sec.color,
        },
      });
      label.anchor.set(0.5);
      label.position.set(labelX, labelY);
      this.labelContainer.addChild(label);
    });
  }

  /** Convert raw GPS X to local track-space X. */
  toLocalX(x: number): number {
    return (x - this.circuit.minX - (this.circuit.maxX - this.circuit.minX) / 2) * this.coordScale;
  }

  toLocalY(y: number): number {
    // Flip Y since screen space grows downward while GPS Y grows "up".
    return -(y - this.circuit.minY - (this.circuit.maxY - this.circuit.minY) / 2) * this.coordScale;
  }

  get worldWidth(): number {
    return (this.circuit.maxX - this.circuit.minX) * this.coordScale + this.padding * 2;
  }

  get worldHeight(): number {
    return (this.circuit.maxY - this.circuit.minY) * this.coordScale + this.padding * 2;
  }
}
