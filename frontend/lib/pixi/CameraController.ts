import type { Application, Container, FederatedPointerEvent } from "pixi.js";
import type { CameraMode } from "@/types/replay";

const MIN_SCALE = 0.3;
const MAX_SCALE = 6;
const FOLLOW_LERP = 0.08;
const SMOOTH_LERP = 0.15; // used for zoom/reset animation toward a target transform
const FIT_MARGIN = 0.85; // leave breathing room around the circuit when auto-fitting

/**
 * Handles wheel-zoom, drag-pan, auto-fit, and camera-follow-driver behavior on a
 * world container. Zoom and reset animate smoothly toward a target transform each
 * tick via `update()`; dragging stays 1:1 for responsiveness.
 */
export class CameraController {
  mode: CameraMode = "free";
  followAbbr: string | null = null;

  private dragging = false;
  private lastPointer = { x: 0, y: 0 };

  private targetScale = 1;
  private targetX = 0;
  private targetY = 0;

  private worldWidth = 0;
  private worldHeight = 0;

  constructor(private app: Application, private world: Container) {
    this.attachEvents();
  }

  private attachEvents(): void {
    const view = this.app.canvas as HTMLCanvasElement;
    view.addEventListener("wheel", this.onWheel, { passive: false });

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointerdown", this.onPointerDown);
    this.app.stage.on("pointermove", this.onPointerMove);
    this.app.stage.on("pointerup", this.onPointerUp);
    this.app.stage.on("pointerupoutside", this.onPointerUp);
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoomAt(e.offsetX, e.offsetY, factor);
  };

  private onPointerDown = (e: FederatedPointerEvent): void => {
    this.dragging = true;
    this.mode = "free"; // manual pan cancels follow mode
    this.lastPointer = { x: e.global.x, y: e.global.y };
  };

  private onPointerMove = (e: FederatedPointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.global.x - this.lastPointer.x;
    const dy = e.global.y - this.lastPointer.y;
    this.world.position.x += dx;
    this.world.position.y += dy;
    // Keep the smoothing target glued to the live position so releasing the
    // drag doesn't cause the camera to snap back toward a stale target.
    this.targetX = this.world.position.x;
    this.targetY = this.world.position.y;
    this.lastPointer = { x: e.global.x, y: e.global.y };
  };

  private onPointerUp = (): void => {
    this.dragging = false;
  };

  private zoomAt(screenX: number, screenY: number, factor: number): void {
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.targetScale * factor));
    const worldPos = {
      x: (screenX - this.world.position.x) / this.world.scale.x,
      y: (screenY - this.world.position.y) / this.world.scale.y,
    };
    this.targetScale = newScale;
    this.targetX = screenX - worldPos.x * newScale;
    this.targetY = screenY - worldPos.y * newScale;
  }

  zoomIn(): void {
    this.zoomAt(this.app.screen.width / 2, this.app.screen.height / 2, 1.2);
  }

  zoomOut(): void {
    this.zoomAt(this.app.screen.width / 2, this.app.screen.height / 2, 0.8);
  }

  /** Store the circuit's local-space size so resetView() can compute a fit-to-screen scale. */
  setWorldBounds(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  /** Smoothly animate back to a centered, fit-to-screen view of the whole circuit. */
  resetView(): void {
    const { width: screenW, height: screenH } = this.app.screen;
    const fitScale =
      this.worldWidth > 0 && this.worldHeight > 0
        ? Math.min(screenW / this.worldWidth, screenH / this.worldHeight) * FIT_MARGIN
        : 1;
    this.targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale));
    this.targetX = screenW / 2;
    this.targetY = screenH / 2;
    this.mode = "free";
    this.followAbbr = null;
  }

  followDriver(abbr: string): void {
    this.mode = "follow";
    this.followAbbr = abbr;
  }

  /** Called every tick. When following, recomputes the target to keep the car centered;
   * always eases current transform toward the target for smooth zoom/pan/reset/follow. */
  update(followedLocalPos: { x: number; y: number } | null): void {
    if (this.mode === "follow" && followedLocalPos) {
      this.targetX = this.app.screen.width / 2 - followedLocalPos.x * this.targetScale;
      this.targetY = this.app.screen.height / 2 - followedLocalPos.y * this.targetScale;
    }

    const lerp = this.mode === "follow" ? FOLLOW_LERP : SMOOTH_LERP;
    this.world.scale.x += (this.targetScale - this.world.scale.x) * lerp;
    this.world.scale.y = this.world.scale.x;
    this.world.position.x += (this.targetX - this.world.position.x) * lerp;
    this.world.position.y += (this.targetY - this.world.position.y) * lerp;
  }

  /** Current animation target (scale + position) — used to snap the world to its
   * fitted transform on first paint instead of animating in from an arbitrary default. */
  getTargetTransform(): { scale: number; x: number; y: number } {
    return { scale: this.targetScale, x: this.targetX, y: this.targetY };
  }

  destroy(): void {
    const view = this.app.canvas as HTMLCanvasElement;
    view.removeEventListener("wheel", this.onWheel);
    this.app.stage.off("pointerdown", this.onPointerDown);
    this.app.stage.off("pointermove", this.onPointerMove);
    this.app.stage.off("pointerup", this.onPointerUp);
    this.app.stage.off("pointerupoutside", this.onPointerUp);
  }
}
