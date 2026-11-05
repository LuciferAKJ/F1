import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { Container } from "pixi.js";
import { CarSprite, CAR_RADIUS } from "../CarSprite";
import { PixiReplayEngine, CANDIDATE_LABEL_SLOTS } from "../PixiReplayEngine";
import type { DriverMeta } from "@/types/replay";

// Mock CanvasRenderingContext2D and 2D canvas context for jsdom environment
class MockCanvasRenderingContext2D {
  font = "";
  imageSmoothingEnabled = true;
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  measureText = (text: string) => ({
    width: text.length * 7,
    actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: 2,
  });
  fillRect = vi.fn();
  clearRect = vi.fn();
  beginPath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  stroke = vi.fn();
  fill = vi.fn();
  arc = vi.fn();
  closePath = vi.fn();
  save = vi.fn();
  restore = vi.fn();
  setTransform = vi.fn();
  drawImage = vi.fn();
  getImageData = () => ({ data: new Uint8ClampedArray(4) });
  putImageData = vi.fn();
  createImageData = () => ({ data: new Uint8ClampedArray(4) });
}

(globalThis as any).CanvasRenderingContext2D = MockCanvasRenderingContext2D;
if (typeof window !== "undefined") {
  (window as any).CanvasRenderingContext2D = MockCanvasRenderingContext2D;
}

beforeAll(() => {
  const mockContext = new MockCanvasRenderingContext2D();

  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
    if (contextId === "2d") return mockContext;
    return null;
  }) as any;
});

describe("CarSprite Rendering & Selection", () => {
  it("initializes with unselected styling and default top offset", () => {
    const car = new CarSprite("VER", "#3671C6", "1");
    expect(car.abbr).toBe("VER");
    expect(car.isSelected).toBe(false);
    expect(car.glowVisible).toBe(false);
    expect(car.labelOffset.x).toBe(0);
    expect(car.labelOffset.y).toBe(-CAR_RADIUS - 10);
  });

  it("applies selection reticle and 1.25x scale multiplier when selected", () => {
    const car = new CarSprite("VER", "#3671C6", "1");
    car.setScale(1.0);
    car.setSelected(true);

    expect(car.isSelected).toBe(true);
    expect(car.glowVisible).toBe(true);
    expect(car.container.scale.x).toBeCloseTo(1.25, 2);
  });

  it("cleanly resets halo and scale when deselected", () => {
    const car = new CarSprite("VER", "#3671C6", "1");
    car.setScale(1.0);
    car.setSelected(true);
    expect(car.glowVisible).toBe(true);

    car.setSelected(false);
    expect(car.isSelected).toBe(false);
    expect(car.glowVisible).toBe(false);
    expect(car.container.scale.x).toBeCloseTo(1.0, 2);
  });

  it("updates label offset dynamically via setLabelOffset", () => {
    const car = new CarSprite("NOR", "#FF8000", "4");
    car.setLabelOffset(28, -4);
    expect(car.labelOffset).toEqual({ x: 28, y: -4 });

    car.setLabelPlacement("bottom");
    expect(car.labelOffset).toEqual({ x: 0, y: CAR_RADIUS + 10 });
  });
});

describe("PixiReplayEngine Selection, Z-Elevation & Multi-Car Label Deconfliction", () => {
  let engine: PixiReplayEngine;
  let world: Container;
  const cars: CarSprite[] = [];

  const mockDrivers: DriverMeta[] = [
    { abbreviation: "VER", teamName: "Red Bull Racing", teamColor: "#3671C6", driverNumber: "1" },
    { abbreviation: "NOR", teamName: "McLaren", teamColor: "#FF8000", driverNumber: "4" },
    { abbreviation: "LEC", teamName: "Ferrari", teamColor: "#E80020", driverNumber: "16" },
    { abbreviation: "HAM", teamName: "Mercedes", teamColor: "#27F4D2", driverNumber: "44" },
  ];

  beforeEach(() => {
    engine = new PixiReplayEngine();
    world = new Container();

    // Directly mount cars into world for focused unit testing without WebGL canvas requirement
    (engine as any).world = world;
    (engine as any).carsList = [];
    (engine as any).placedLabels = [];

    cars.length = 0;
    for (const d of mockDrivers) {
      const car = new CarSprite(d.abbreviation, d.teamColor, d.driverNumber);
      (engine as any).cars.set(d.abbreviation, car);
      (engine as any).carsList.push(car);
      (engine as any).placedLabels.push({ x: 0, y: 0 });
      world.addChild(car.container);
      cars.push(car);
    }
  });

  it("elevates selected driver to the topmost z-index in world container", () => {
    // Select NOR
    engine.setSelectedDriver("NOR");
    const norCar = engine.getCar("NOR");
    expect(norCar?.isSelected).toBe(true);

    // The last child in world.children must be NOR's container
    const children = world.children;
    expect(children[children.length - 1]).toBe(norCar!.container);
  });

  it("handles switching between selected drivers and deselecting cleanly", () => {
    // Select VER
    engine.setSelectedDriver("VER");
    const verCar = engine.getCar("VER")!;
    expect(verCar.isSelected).toBe(true);
    expect(world.children[world.children.length - 1]).toBe(verCar.container);

    // Switch to LEC
    engine.setSelectedDriver("LEC");
    const lecCar = engine.getCar("LEC")!;
    expect(verCar.isSelected).toBe(false);
    expect(lecCar.isSelected).toBe(true);
    expect(world.children[world.children.length - 1]).toBe(lecCar.container);

    // Deselect (null)
    engine.setSelectedDriver(null);
    expect(lecCar.isSelected).toBe(false);
    expect(verCar.isSelected).toBe(false);
  });

  it("prioritizes selected driver for primary top slot during label deconfliction", () => {
    const ver = engine.getCar("VER")!;
    const nor = engine.getCar("NOR")!;

    // Place them very close together
    ver.container.position.set(100, 100);
    nor.container.position.set(102, 101);

    // Select NOR
    engine.setSelectedDriver("NOR");
    engine.deconflictLabels();

    // Selected driver NOR must get the primary top slot
    expect(nor.labelOffset.x).toBe(CANDIDATE_LABEL_SLOTS[0].dx);
    expect(nor.labelOffset.y).toBe(CANDIDATE_LABEL_SLOTS[0].dy);

    // Neighbor VER must NOT have identical top offset (must de-conflict)
    expect(ver.labelOffset).not.toEqual(nor.labelOffset);
  });

  it("assigns non-overlapping label slots for three or more cars in close formation", () => {
    const [ver, nor, lec, ham] = cars;

    // Place 4 cars tightly clustered around (100, 100)
    ver.container.position.set(100, 100);
    nor.container.position.set(108, 102);
    lec.container.position.set(96, 106);
    ham.container.position.set(104, 110);

    engine.setSelectedDriver("VER");
    engine.deconflictLabels();

    const absoluteLabelPositions = cars.map((c) => ({
      abbr: c.abbr,
      x: c.container.position.x + c.labelOffset.x,
      y: c.container.position.y + c.labelOffset.y,
    }));

    // Verify all 4 cars have pairwise non-overlapping label bounding boxes
    for (let i = 0; i < absoluteLabelPositions.length; i++) {
      for (let j = i + 1; j < absoluteLabelPositions.length; j++) {
        const p1 = absoluteLabelPositions[i];
        const p2 = absoluteLabelPositions[j];
        const dx = Math.abs(p1.x - p2.x);
        const dy = Math.abs(p1.y - p2.y);

        // A collision occurs if both dx < 28 and dy < 15
        const isColliding = dx < 28 && dy < 15;
        expect(
          isColliding,
          `Labels for ${p1.abbr} and ${p2.abbr} overlap at (${p1.x}, ${p1.y}) vs (${p2.x}, ${p2.y})`
        ).toBe(false);
      }
    }
  });
});
