import { Application, Container } from "pixi.js";
import { TrackLayer } from "./TrackLayer";
import { CarSprite } from "./CarSprite";
import { CameraController } from "./CameraController";
import type { CircuitData, DriverMeta, ReplayFrame } from "@/types/replay";

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
  private ready = false;
  private selectedAbbr: string | null = null;
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

    for (const driver of drivers) {
      const car = new CarSprite(driver.abbreviation, driver.teamColor, driver.driverNumber);
      this.cars.set(driver.abbreviation, car);
      world.addChild(car.container);
    }

    this.camera = new CameraController(app, world);
    this.camera.setWorldBounds(this.trackLayer.worldWidth, this.trackLayer.worldHeight);
    this.camera.resetView();
    // Start already-fitted rather than animating in from a default transform on first paint.
    const initial = this.camera.getTargetTransform();
    world.scale.set(initial.scale);
    world.position.set(initial.x, initial.y);

    app.ticker.add(this.onTick);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.ready = true;
  }

  private onTick = (): void => {
    if (!this.camera) return;
    this.cars.forEach((car) => car.tick());

    let followedPos: { x: number; y: number } | null = null;
    if (this.camera.mode === "follow" && this.camera.followAbbr) {
      const followed = this.cars.get(this.camera.followAbbr);
      if (followed) followedPos = { x: followed.container.position.x, y: followed.container.position.y };
    }
    this.camera.update(followedPos);
  };

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
    if (abbr) this.cars.get(abbr)?.setSelected(true);
  }

  zoomIn(): void { this.camera?.zoomIn(); }
  zoomOut(): void { this.camera?.zoomOut(); }
  resetView(): void { this.camera?.resetView(); }
  followDriver(abbr: string): void { this.camera?.followDriver(abbr); }
  stopFollowing(): void { if (this.camera) this.camera.mode = "free"; }

  destroy(): void {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.app?.ticker.remove(this.onTick);
    this.camera?.destroy();
    this.cars.forEach((car) => car.destroy());
    this.cars.clear();
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.ready = false;
  }
}
