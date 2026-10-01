import { Container, Graphics, Text } from "pixi.js";
import type { DriverFrame } from "@/types/replay";

const RADIUS = 10;
const POSITION_LERP = 0.35; // smoothing between successive target positions
const ROTATION_LERP = 0.25;

/**
 * A single car: team-colored circle with a heading "nose", driver number inside,
 * driver abbreviation label above, and an optional glow ring when selected.
 * Position and rotation both ease toward their latest target each tick.
 */
export class CarSprite {
  readonly container: Container;
  private glow: Graphics;
  private carGroup: Container; // rotates with heading; label stays upright
  private circle: Graphics;
  private nose: Graphics;
  private numberText: Text;
  private label: Text;

  private targetX = 0;
  private targetY = 0;
  private targetRotation = 0;
  private initialized = false;
  private selected = false;

  constructor(readonly abbr: string, teamColorHex: string, driverNumber: string) {
    this.container = new Container();

    this.glow = new Graphics();
    this.glow.visible = false;
    this.container.addChild(this.glow);

    this.carGroup = new Container();
    this.container.addChild(this.carGroup);

    const colorNum = this.hexToNumber(teamColorHex);

    this.circle = new Graphics()
      .circle(0, 0, RADIUS)
      .fill(colorNum)
      .stroke({ width: 1.5, color: 0x000000 });
    this.carGroup.addChild(this.circle);

    // Small forward-facing wedge to convey heading at a glance.
    this.nose = new Graphics()
      .moveTo(RADIUS + 5, 0)
      .lineTo(RADIUS - 2, -4)
      .lineTo(RADIUS - 2, 4)
      .closePath()
      .fill(0xffffff);
    this.carGroup.addChild(this.nose);

    this.numberText = new Text({
      text: driverNumber,
      style: { fontFamily: "Arial", fontSize: 8, fontWeight: "bold", fill: 0xffffff },
    });
    this.numberText.anchor.set(0.5);
    this.carGroup.addChild(this.numberText);

    this.label = new Text({
      text: abbr,
      style: { fontFamily: "Arial", fontSize: 11, fontWeight: "bold", fill: 0xffffff },
    });
    this.label.anchor.set(0.5, 1);
    this.label.position.set(0, -RADIUS - 4);
    this.container.addChild(this.label);

    this.drawGlow(colorNum);
  }

  private hexToNumber(hex: string): number {
    const clean = hex?.replace("#", "") || "ffffff";
    return parseInt(clean.length === 6 ? clean : "ffffff", 16);
  }

  private drawGlow(colorNum: number): void {
    this.glow.clear();
    // Soft layered rings stand in for a blur/glow filter (keeps the engine dependency-free).
    for (const [r, a] of [[RADIUS + 10, 0.08], [RADIUS + 6, 0.16], [RADIUS + 3, 0.28]] as const) {
      this.glow.circle(0, 0, r).fill({ color: colorNum, alpha: a });
    }
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.glow.visible = selected;
  }

  /** Set the new target position (called once per data frame update); derives heading from movement. */
  setTarget(localX: number, localY: number): void {
    if (!this.initialized) {
      this.container.position.set(localX, localY);
      this.initialized = true;
      this.targetX = localX;
      this.targetY = localY;
      return;
    }
    const dx = localX - this.targetX;
    const dy = localY - this.targetY;
    if (Math.hypot(dx, dy) > 0.15) {
      this.targetRotation = Math.atan2(dy, dx);
    }
    this.targetX = localX;
    this.targetY = localY;
  }

  updateTelemetry(frame: DriverFrame): void {
    this.label.text = frame.pit ? `${this.abbr} P` : this.abbr;
  }

  /** Called every render tick (60 FPS) to smoothly ease position + rotation toward the latest target. */
  tick(): void {
    const dx = this.targetX - this.container.position.x;
    const dy = this.targetY - this.container.position.y;
    this.container.position.x += dx * POSITION_LERP;
    this.container.position.y += dy * POSITION_LERP;

    let delta = this.targetRotation - this.carGroup.rotation;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta)); // shortest angular path
    this.carGroup.rotation += delta * ROTATION_LERP;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
