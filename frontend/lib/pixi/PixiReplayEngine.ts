import { Application, Container } from "pixi.js";
import { TrackLayer } from "./TrackLayer";
import { CarSprite } from "./CarSprite";
import { CameraController } from "./CameraController";
import type { CircuitData, DriverMeta, ReplayFrame } from "@/types/replay";

export interface LabelSlot {
  dx: number;
  dy: number;
}

// Ordered candidate slots for driver abbreviation label positioning
export const CANDIDATE_LABEL_SLOTS: readonly LabelSlot[] = [
  { dx: 0, dy: -23 },   // 0. Primary: Directly above car
  { dx: 0, dy: 23 },    // 1. Secondary: Directly below car
  { dx: 28, dy: -4 },   // 2. Lateral Right
  { dx: -28, dy: -4 },  // 3. Lateral Left
  { dx: 28, dy: 16 },   // 4. Diagonal Bottom-Right
  { dx: -28, dy: 16 },  // 5. Diagonal Bottom-Left
  { dx: 24, dy: -26 },  // 6. Diagonal Top-Right
  { dx: -24, dy: -26 }, // 7. Diagonal Top-Left
];

/**
 * Owns the PIXI.Application lifecycle and renders the live race replay.
 * External state (current ReplayFrame) is pushed in via `setFrame()`;
 * this engine only handles rendering/interpolation/camera, never owns playback timing.
 */
export class PixiReplayEngine {
  private app: Application | null = null;
  private world: Container | null = null;
  private trackLayer: TrackLayer | null = null;
  private camera: CameraController | null = null;
  private cars = new Map<string, CarSprite>();
  private carsList: CarSprite[] = [];
  private ready = false;
  private selectedAbbr: string | null = null;
  private pendingFollow: string | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private onFollowChange: ((abbr: string | null) => void) | null = null;

  // Pre-allocated coordinates cache to prevent per-frame GC allocations
  private placedLabels: { x: number; y: number }[] = [];
  private lastMarkerScale = -1;
  private lastDeconflictedPositions: { x: number; y: number }[] = [];
  private lastDeconflictedSelectedAbbr: string | null = null;

  private onVisibilityChange = (): void => {
    if (!this.app) return;
    if (document.hidden) this.app.ticker.stop();
    else this.app.ticker.start();
  };

  async init(container: HTMLDivElement, circuit: CircuitData, drivers: DriverMeta[]): Promise<void> {
    const app = new Application();
    await app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      roundPixels: true,
    });
    container.appendChild(app.canvas);
    this.app = app;

    const world = new Container();
    app.stage.addChild(world);
    this.world = world;

    this.trackLayer = new TrackLayer(circuit);
    world.addChild(this.trackLayer.container);

    this.carsList = [];
    this.placedLabels = [];
    this.lastDeconflictedPositions = [];
    this.lastMarkerScale = -1;

    for (const driver of drivers) {
      const car = new CarSprite(driver.abbreviation, driver.teamColor, driver.driverNumber);
      this.cars.set(driver.abbreviation, car);
      this.carsList.push(car);
      this.placedLabels.push({ x: 0, y: 0 });
      this.lastDeconflictedPositions.push({ x: -9999, y: -9999 });
      world.addChild(car.container);
    }

    this.camera = new CameraController(app, world);
    if (this.onFollowChange) {
      this.camera.onFollowChange = this.onFollowChange;
    }
    this.camera.setWorldBounds(this.trackLayer.worldWidth, this.trackLayer.worldHeight);
    this.camera.resetView();
    if (this.pendingFollow) {
      this.camera.followDriver(this.pendingFollow);
      this.pendingFollow = null;
    }
    // Start already-fitted rather than animating in from a default transform on first paint.
    const initial = this.camera.getTargetTransform();
    world.scale.set(initial.scale);
    world.position.set(initial.x, initial.y);

    this.resizeObserver = new ResizeObserver(() => {
      this.camera?.handleResize();
    });
    this.resizeObserver.observe(container);

    app.ticker.add(this.onTick);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.ready = true;
  }

  private onTick = (ticker?: { deltaMS: number }): void => {
    if (!this.camera) return;
    const deltaMS = ticker?.deltaMS ?? this.app?.ticker?.deltaMS ?? 16.667;

    const currentScale = this.world?.scale.x ?? 1;
    if (currentScale > 0) {
      // Keep car markers easily visible and readable across all zoom levels and screen sizes.
      const markerScale = Math.max(0.6, Math.min(2.5, 0.9 / currentScale));
      if (Math.abs(markerScale - this.lastMarkerScale) > 0.001) {
        this.lastMarkerScale = markerScale;
        for (let i = 0; i < this.carsList.length; i++) {
          this.carsList[i].setScale(markerScale);
        }
      }
    }
    for (let i = 0; i < this.carsList.length; i++) {
      this.carsList[i].tick(deltaMS);
    }

    // Dynamic collision-aware multi-slot label deconfliction (evaluated only on motion/selection change)
    this.deconflictLabels(false);

    let followedPos: { x: number; y: number } | null = null;
    if (this.camera.mode === "follow" && this.camera.followAbbr) {
      const followed = this.cars.get(this.camera.followAbbr);
      if (followed) followedPos = { x: followed.container.position.x, y: followed.container.position.y };
    }
    this.camera.update(followedPos, deltaMS);
  };

  /**
   * Deterministic, multi-slot collision avoidance for driver labels.
   * Prioritizes the selected driver (always receives its primary top slot).
   * For dense packs of 3+ cars, evaluates candidate slots around each car's perimeter
   * and picks the first slot free of label-on-label and label-on-car overlap.
   */
  deconflictLabels(force = true): void {
    const totalCars = this.carsList.length;
    if (totalCars === 0) return;

    if (!force) {
      let needsDeconflict = this.selectedAbbr !== this.lastDeconflictedSelectedAbbr;
      if (!needsDeconflict) {
        for (let i = 0; i < totalCars; i++) {
          const car = this.carsList[i];
          const last = this.lastDeconflictedPositions[i];
          if (!last || Math.hypot(car.container.position.x - last.x, car.container.position.y - last.y) > 0.5) {
            needsDeconflict = true;
            break;
          }
        }
      }
      if (!needsDeconflict) return;
    }

    this.lastDeconflictedSelectedAbbr = this.selectedAbbr;
    for (let i = 0; i < totalCars; i++) {
      const car = this.carsList[i];
      if (!this.lastDeconflictedPositions[i]) {
        this.lastDeconflictedPositions[i] = { x: car.container.position.x, y: car.container.position.y };
      } else {
        this.lastDeconflictedPositions[i].x = car.container.position.x;
        this.lastDeconflictedPositions[i].y = car.container.position.y;
      }
    }

    let placedCount = 0;

    // 1. If a driver is selected, position it first with highest priority
    let selectedCar: CarSprite | null = null;
    if (this.selectedAbbr) {
      selectedCar = this.cars.get(this.selectedAbbr) ?? null;
      if (selectedCar) {
        // Selected car always takes candidate slot 0 (primary top)
        const primarySlot = CANDIDATE_LABEL_SLOTS[0];
        selectedCar.setLabelOffset(primarySlot.dx, primarySlot.dy);
        this.placedLabels[placedCount].x = selectedCar.container.position.x + primarySlot.dx;
        this.placedLabels[placedCount].y = selectedCar.container.position.y + primarySlot.dy;
        placedCount++;
      }
    }

    // 2. Position all remaining unselected cars
    const LABEL_OVERLAP_W = 28;
    const LABEL_OVERLAP_H = 15;
    const CAR_OVERLAP_W = 18;
    const CAR_OVERLAP_H = 14;

    for (let i = 0; i < totalCars; i++) {
      const car = this.carsList[i];
      if (car === selectedCar) continue;

      const posX = car.container.position.x;
      const posY = car.container.position.y;

      let chosenSlot = CANDIDATE_LABEL_SLOTS[0];
      let bestPenalty = Infinity;

      for (let s = 0; s < CANDIDATE_LABEL_SLOTS.length; s++) {
        const slot = CANDIDATE_LABEL_SLOTS[s];
        const candX = posX + slot.dx;
        const candY = posY + slot.dy;

        let hasOverlap = false;
        let penalty = 0;

        // Check against previously placed labels
        for (let p = 0; p < placedCount; p++) {
          const plX = this.placedLabels[p].x;
          const plY = this.placedLabels[p].y;
          const dx = Math.abs(candX - plX);
          const dy = Math.abs(candY - plY);

          if (dx < LABEL_OVERLAP_W && dy < LABEL_OVERLAP_H) {
            hasOverlap = true;
            penalty += (LABEL_OVERLAP_W - dx) + (LABEL_OVERLAP_H - dy);
            break;
          }
        }

        // Check against other car circle centers so label doesn't cover another car
        if (!hasOverlap) {
          for (let j = 0; j < totalCars; j++) {
            if (i === j) continue;
            const otherCar = this.carsList[j];
            const otherX = otherCar.container.position.x;
            const otherY = otherCar.container.position.y;
            const dx = Math.abs(candX - otherX);
            const dy = Math.abs(candY - otherY);

            if (dx < CAR_OVERLAP_W && dy < CAR_OVERLAP_H) {
              hasOverlap = true;
              penalty += (CAR_OVERLAP_W - dx) + (CAR_OVERLAP_H - dy);
              break;
            }
          }
        }

        if (!hasOverlap) {
          chosenSlot = slot;
          break; // Found clean, non-conflicting slot
        }

        // Keep track of least-conflicting slot as fallback
        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          chosenSlot = slot;
        }
      }

      car.setLabelOffset(chosenSlot.dx, chosenSlot.dy);
      this.placedLabels[placedCount].x = posX + chosenSlot.dx;
      this.placedLabels[placedCount].y = posY + chosenSlot.dy;
      placedCount++;
    }
  }

  /** Push a new data frame from the replay/timeline hook — updates car targets. */
  setFrame(frame: ReplayFrame): void {
    if (!this.ready || !this.trackLayer) return;
    for (const [abbr, driverFrame] of Object.entries(frame.drivers)) {
      const car = this.cars.get(abbr);
      if (!car) continue;
      const localX = this.trackLayer.toLocalX(driverFrame.x);
      const localY = this.trackLayer.toLocalY(driverFrame.y);
      car.setTarget(localX, localY);
      car.updateTelemetry(driverFrame);
    }
  }

  setSelectedDriver(abbr: string | null): void {
    if (this.selectedAbbr) this.cars.get(this.selectedAbbr)?.setSelected(false);
    this.selectedAbbr = abbr;
    if (abbr) {
      const car = this.cars.get(abbr);
      if (car) {
        car.setSelected(true);
        // Elevate selected driver to topmost z-order in world container
        if (this.world) {
          this.world.addChild(car.container);
        }
      }
    }
    this.deconflictLabels(true);
  }

  getCar(abbr: string): CarSprite | undefined {
    return this.cars.get(abbr);
  }

  getWorldContainer(): Container | null {
    return this.world;
  }

  setFollowChangeHandler(handler: (abbr: string | null) => void): void {
    this.onFollowChange = handler;
    if (this.camera) {
      this.camera.onFollowChange = handler;
    }
  }

  zoomIn(): void { this.camera?.zoomIn(); }
  zoomOut(): void { this.camera?.zoomOut(); }
  resetView(): void { this.camera?.resetView(); }
  followDriver(abbr: string): void {
    if (this.camera) {
      this.camera.followDriver(abbr);
    } else {
      this.pendingFollow = abbr;
    }
  }
  stopFollowing(): void {
    this.pendingFollow = null;
    this.camera?.stopFollowing();
  }

  destroy(): void {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.app?.ticker.remove(this.onTick);
    this.camera?.destroy();
    this.cars.forEach((car) => car.destroy());
    this.cars.clear();
    this.carsList = [];
    this.placedLabels = [];
    this.lastDeconflictedPositions = [];
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.ready = false;
  }
}
