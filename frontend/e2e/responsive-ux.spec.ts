import { test, expect } from "@playwright/test";
import path from "path";

const VIEWPORTS = [
  { name: "mobile_320x640", width: 320, height: 640, isMobile: true },
  { name: "mobile_360x800", width: 360, height: 800, isMobile: true },
  { name: "mobile_390x844", width: 390, height: 844, isMobile: true },
  { name: "mobile_430x932", width: 430, height: 932, isMobile: true },
  { name: "tablet_768x1024", width: 768, height: 1024, isMobile: true },
  { name: "compact_1024x768", width: 1024, height: 768, isMobile: false },
  { name: "laptop_1366x768", width: 1366, height: 768, isMobile: false },
  { name: "desktop_1440x900", width: 1440, height: 900, isMobile: false },
  { name: "pitwall_1920x1080", width: 1920, height: 1080, isMobile: false },
];

test.describe("Responsive Architecture & Multi-Viewport Suite", () => {
  test.setTimeout(120_000);

  const mockMetadata = {
    info: {
      year: 0,
      event: "Demo Grand Prix",
      sessionType: "R",
      sessionName: "Demo Race (Sample Telemetry)",
      totalLaps: 5,
      isDemo: true,
    },
    drivers: [
      { abbreviation: "VER", teamName: "Red Bull Racing", teamColor: "#3671C6", driverNumber: "1" },
      { abbreviation: "NOR", teamName: "McLaren", teamColor: "#FF8000", driverNumber: "4" },
      { abbreviation: "LEC", teamName: "Ferrari", teamColor: "#E80020", driverNumber: "16" },
      { abbreviation: "HAM", teamName: "Mercedes", teamColor: "#27F4D2", driverNumber: "44" },
    ],
    circuit: {
      x: [0, 50, 100, 150, 200, 100, 0],
      y: [0, 30, 60, 40, 10, -20, 0],
      minX: 0,
      maxX: 200,
      minY: -20,
      maxY: 60,
    },
    totalLaps: 5,
    duration: 59.5,
    frameInterval: 0.5,
    frameCount: 120,
    isDemo: true,
  };

  const mockReplay = {
    info: mockMetadata.info,
    drivers: mockMetadata.drivers,
    circuit: mockMetadata.circuit,
    frames: [
      {
        timestamp: 0.0,
        lap: 1,
        drivers: [
          { driverId: "VER", x: 0, y: 0, speed: 280, gear: 6, throttle: 100, brake: false, rpm: 11000, drs: 0, tyre: "MEDIUM", lap: 1, sector: 1, position: 1 },
          { driverId: "NOR", x: -10, y: -5, speed: 275, gear: 6, throttle: 98, brake: false, rpm: 10800, drs: 0, tyre: "MEDIUM", lap: 1, sector: 1, position: 2 },
          { driverId: "LEC", x: -20, y: -10, speed: 270, gear: 6, throttle: 95, brake: false, rpm: 10600, drs: 0, tyre: "HARD", lap: 1, sector: 1, position: 3 },
          { driverId: "HAM", x: -30, y: -15, speed: 268, gear: 5, throttle: 90, brake: true, rpm: 10400, drs: 0, tyre: "SOFT", lap: 1, sector: 1, position: 4 },
        ],
      },
      {
        timestamp: 0.5,
        lap: 1,
        drivers: [
          { driverId: "VER", x: 20, y: 10, speed: 285, gear: 7, throttle: 100, brake: false, rpm: 11200, drs: 0, tyre: "MEDIUM", lap: 1, sector: 1, position: 1 },
          { driverId: "NOR", x: 10, y: 5, speed: 280, gear: 6, throttle: 100, brake: false, rpm: 11000, drs: 0, tyre: "MEDIUM", lap: 1, sector: 1, position: 2 },
          { driverId: "LEC", x: 0, y: 0, speed: 276, gear: 6, throttle: 98, brake: false, rpm: 10900, drs: 0, tyre: "HARD", lap: 1, sector: 1, position: 3 },
          { driverId: "HAM", x: -10, y: -5, speed: 272, gear: 6, throttle: 92, brake: false, rpm: 10500, drs: 0, tyre: "SOFT", lap: 1, sector: 1, position: 4 },
        ],
      },
    ],
    raceDuration: 59.5,
    isDemo: true,
  };

  test.beforeEach(async ({ page }) => {
    // Route WebSockets to avoid connection refused in CI
    await page.routeWebSocket("**/ws/replay/**", (ws) => {
      ws.onMessage((msg) => {
        try {
          const payload = typeof msg === "string" ? JSON.parse(msg) : JSON.parse(msg.toString());
          if (payload.action === "play" && mockReplay.frames[1]) {
            ws.send(JSON.stringify({ type: "frame", frame: mockReplay.frames[1] }));
          }
        } catch {}
      });
    });

    // Route replay API endpoints
    await page.route("**/api/replay/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/metadata")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMetadata),
        });
      }
      if (url.includes("/frame/")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ frame: mockReplay.frames[0] }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockReplay),
      });
    });
  });

  for (const vp of VIEWPORTS) {
    test(`renders cleanly with zero horizontal overflow at ${vp.width}x${vp.height} (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/replay/demo", { waitUntil: "domcontentloaded" });

      // Verify canvas container is mounted
      const canvas = page.locator("[data-testid='replay-canvas']");
      await expect(canvas).toBeAttached({ timeout: 20_000 });

      // Strict horizontal overflow check
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow, `Document-level horizontal overflow detected at ${vp.width}x${vp.height}`).toBe(false);

      // Verify transport controls are visible and not clipped
      const playPauseBtn = page.getByRole("button", { name: /^(Play|Pause) replay/i }).first();
      await expect(playPauseBtn).toBeVisible({ timeout: 10_000 });

      // If mobile layout (<1024px), verify mobile tab switcher operates smoothly
      if (vp.isMobile) {
        const nav = page.getByRole("navigation", { name: /Mobile replay navigation/i });
        await expect(nav).toBeVisible();

        // Switch to Timing
        const timingBtn = nav.getByRole("button", { name: /Timing/i });
        await timingBtn.click();
        const verBtn = page.getByRole("button", { name: /Select.*VER/i }).first();
        await expect(verBtn).toBeVisible();

        // Select driver
        await verBtn.click();

        // Switch to Telemetry
        const telemetryBtn = nav.getByRole("button", { name: /Telemetry/i });
        await telemetryBtn.click();
        await expect(page.getByText("TELEMETRY DECK")).toBeVisible();

        // Switch back to Track
        const trackBtn = nav.getByRole("button", { name: /Track/i });
        await trackBtn.click();
        await expect(canvas).toBeVisible();
      } else {
        // Desktop 3-column workstation mode
        await expect(page.getByText("ANALYTICS WORKBENCH")).toBeVisible();
        const verBtn = page.getByRole("button", { name: /Select.*VER/i }).first();
        await expect(verBtn).toBeVisible();
      }

      // Capture visual audit screenshot for this viewport
      const screenshotPath = path.resolve(
        process.cwd(),
        "..",
        "docs",
        "screenshots",
        `${vp.name}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
    });
  }

  test("homepage 'Try Demo' navigates to canonical /replay/demo route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.route("**/api/sessions/*/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");
    const tryDemoBtn = page.getByRole("button", { name: /Try Demo/i });
    await expect(tryDemoBtn).toBeVisible();
    await tryDemoBtn.click();
    await expect(page).toHaveURL(/\/replay\/demo$/);
  });
});

