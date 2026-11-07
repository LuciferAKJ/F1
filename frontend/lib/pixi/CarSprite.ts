import { Container, Graphics, Text } from "pixi.js";
import type { DriverFrame } from "@/types/replay";

export const CAR_RADIUS = 13;
const POSITION_LERP = 0.35; // smoothing between successive target positions
const ROTATION_LERP = 0.25;

/**
 * A single car: team-colored circle with a heading "nose", driver number inside,
 * driver abbreviation pill badge above/below/offset, and high-visibility selection reticle.
 * Position and rotation ease toward their latest target each tick.
 */
export class CarSprite {
  readonly container: Container;
  private glow: Graphics;
  private carGroup: Container; // rotates with heading; label stays upright
  private circle: Graphics;
  private nose: Graphics;
  private numberText: Text;

  private labelContainer: Container;
  private labelPill: Graphics;
  private labelText: Text;

  private targetX = 0;
  private targetY = 0;
  private targetRotation = 0;
  private initialized = false;
  private selected = false;
  private baseScale = 1.0;
  private colorNum: number;
  private labelOffsetX = 0;
  private labelOffsetY = -CAR_RADIUS - 10;

  constructor(readonly abbr: string, teamColorHex: string, driverNumber: string) {
    this.container = new Container();
    this.colorNum = this.hexToNumber(teamColorHex);

    // High-visibility selection reticle & halo
    this.glow = new Graphics();
    this.glow.visible = false;
    this.container.addChild(this.glow);

    this.carGroup = new Container();
    this.container.addChild(this.carGroup);

    this.circle = new Graphics()
      .circle(0, 0, CAR_RADIUS)
      .fill(this.colorNum)
      .stroke({ width: 1.5, color: 0x000000 });
    this.carGroup.addChild(this.circle);

    // Small forward-facing wedge to convey heading at a glance.
    this.nose = new Graphics()
      .moveTo(CAR_RADIUS + 5, 0)
      .lineTo(CAR_RADIUS - 2, -4)
      .lineTo(CAR_RADIUS - 2, 4)
      .closePath()
      .fill(0xffffff);
    this.carGroup.addChild(this.nose);

    this.numberText = new Text({
      text: driverNumber,
      style: { fontFamily: "Arial", fontSize: 8, fontWeight: "bold", fill: 0xffffff },
    });
    this.numberText.anchor.set(0.5);
    this.carGroup.addChild(this.numberText);

    // Label container with rounded pill badge background
    this.labelContainer = new Container();
    this.labelPill = new Graphics();
    this.labelContainer.addChild(this.labelPill);

    this.labelText = new Text({
      text: abbr,
      style: {
        fontFamily: "Arial",
        fontSize: 10,
        fontWeight: "bold",
        fill: 0xffffff,
      },
    });
    this.labelText.anchor.set(0.5, 0.5);
    this.labelContainer.addChild(this.labelText);

    this.labelContainer.position.set(this.labelOffsetX, this.labelOffsetY);
    this.container.addChild(this.labelContainer);

    this.drawLabelPill(false);
    this.drawGlow();
  }

  private hexToNumber(hex: string): number {
    const clean = hex?.replace("#", "") || "ffffff";
    return parseInt(clean.length === 6 ? clean : "ffffff", 16);
  }

  private drawLabelPill(isSelected: boolean): void {
    this.labelPill.clear();
    const textWidth = Math.max(28, this.labelText.width + 8);
    const height = 15;
    const halfW = textWidth / 2;
    const halfH = height / 2;

    // Dark high-contrast rounded background with team or selected border
    this.labelPill
      .roundRect(-halfW, -halfH, textWidth, height, 3)
      .fill({ color: 0x09090b, alpha: 0.9 })
      .stroke({ width: isSelected ? 1.5 : 1.0, color: isSelected ? 0xfacc15 : this.colorNum });
  }

  private drawGlow(): void {
    this.glow.clear();
    // High-visibility layered selection reticle
    // 1. Outer soft aura
    this.glow.circle(0, 0, CAR_RADIUS + 12).fill({ color: this.colorNum, alpha: 0.18 });
    this.glow.circle(0, 0, CAR_RADIUS + 7).fill({ color: this.colorNum, alpha: 0.28 });
    // 2. Crisp targeting ring
    this.glow.circle(0, 0, CAR_RADIUS + 4).stroke({ width: 2.0, color: 0xffffff, alpha: 0.95 });
    // 3. Four cardinal ticks for instant visual identification
    const tickLen = 4;
    const tickDist = CAR_RADIUS + 5;
    this.glow
      .moveTo(0, -tickDist).lineTo(0, -tickDist - tickLen)
      .moveTo(0, tickDist).lineTo(0, tickDist + tickLen)
      .moveTo(-tickDist, 0).lineTo(-tickDist - tickLen, 0)
      .moveTo(tickDist, 0).lineTo(tickDist + tickLen, 0)
      .stroke({ width: 2.0, color: 0xfacc15, alpha: 1.0 });
  }

  /** Set exact relative offset for driver label (used by multi-slot collision deconfliction). */
  setLabelOffset(dx: number, dy: number): void {
    if (this.labelOffsetX === dx && this.labelOffsetY === dy) return;
    this.labelOffsetX = dx;
    this.labelOffsetY = dy;
    this.labelContainer.position.set(dx, dy);
  }

  /** Legacy helper for top/bottom placement. */
  setLabelPlacement(placement: "top" | "bottom"): void {
    if (placement === "top") {
      this.setLabelOffset(0, -CAR_RADIUS - 10);
    } else {
      this.setLabelOffset(0, CAR_RADIUS + 10);
    }
  }

  get labelOffset(): { x: number; y: number } {
    return { x: this.labelOffsetX, y: this.labelOffsetY };
  }

  get isSelected(): boolean {
    return this.selected;
  }

  get glowVisible(): boolean {
    return this.glow.visible;
  }

  setScale(scale: number): void {
    if (Math.abs(this.baseScale - scale) < 0.0001) return;
    this.baseScale = scale;
    const effectiveScale = this.selected ? scale * 1.25 : scale;
    this.container.scale.set(effectiveScale);
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.glow.visible = selected;
    this.drawLabelPill(selected);
    const effectiveScale = selected ? this.baseScale * 1.25 : this.baseScale;
    this.container.scale.set(effectiveScale);
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
    const nextText = frame.pit ? `${this.abbr} P` : this.abbr;
    if (this.labelText.text !== nextText) {
      this.labelText.text = nextText;
      this.drawLabelPill(this.selected);
    }
  }

  /** Called every render tick to smoothly ease position + rotation toward the latest target (frame-rate independent when deltaMS is provided). */
  tick(deltaMS?: number): void {
    const dx = this.targetX - this.container.position.x;
    const dy = this.targetY - this.container.position.y;

    const posLerp =
      deltaMS !== undefined && deltaMS > 0
        ? 1 - Math.exp(-25.8471 * (deltaMS / 1000))
        : POSITION_LERP;
    const rotLerp =
      deltaMS !== undefined && deltaMS > 0
        ? 1 - Math.exp(-17.2609 * (deltaMS / 1000))
        : ROTATION_LERP;

    this.container.position.x += dx * posLerp;
    this.container.position.y += dy * posLerp;

    let delta = this.targetRotation - this.carGroup.rotation;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta)); // shortest angular path
    this.carGroup.rotation += delta * rotLerp;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
