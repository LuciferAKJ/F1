import { test, expect } from "@playwright/test";

test.describe("Demo Replay & Fallback Flow", () => {
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
        ],
      },
      {
        timestamp: 0.5,
        lap: 1,
        drivers: [
          { driverId: "VER", x: 20, y: 10, speed: 285, gear: 7, throttle: 100, brake: false, rpm: 11200, drs: 0, tyre: "MEDIUM", lap: 1, sector: 1, position: 1 },
          { driverId: "NOR", x: 10, y: 5, speed: 280, gear: 6, throttle: 100, brake: false, rpm: 11000, drs: 0, tyre: "MEDIUM", lap: 1, sector: 1, position: 2 },
        ],
      },
    ],
    raceDuration: 59.5,
    isDemo: true,
  };

  let pageErrors: Error[] = [];
  let unexpectedConsoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    unexpectedConsoleErrors = [];

    // Capture uncaught page errors
    page.on("pageerror", (error) => {
      pageErrors.push(error);
      console.error(`[BROWSER UNCAUGHT PAGEERROR]: ${error.message}\n${error.stack || ""}`);
    });

    // Record console errors, distinguishing expected fixture responses (e.g. 404 test scenarios)
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        const isExpectedFixtureError =
          text.includes("404") ||
          text.includes("Failed to load resource") ||
          text.includes("Formula 1 restricted unauthenticated access");

        if (!isExpectedFixtureError) {
          unexpectedConsoleErrors.push(text);
          console.error(`[BROWSER CONSOLE ERROR]: ${text}`);
        } else {
          console.log(`[BROWSER EXPECTED CONSOLE MSG]: ${text}`);
        }
      }
    });

    // Mock WebSocket connection to avoid connection-refused errors against localhost:8000
    await page.routeWebSocket("**/ws/replay/**", (ws) => {
      ws.onMessage((message) => {
        try {
          const payload = typeof message === "string" ? JSON.parse(message) : JSON.parse(message.toString());
          if (payload.action === "play") {
            // Supply next frame from fixture if requested
            if (mockReplay.frames[1]) {
              ws.send(JSON.stringify({ type: "frame", frame: mockReplay.frames[1] }));
            }
          }
        } catch {
          // Ignore parse errors from non-JSON messages
        }
      });
    });
  });

  test.afterEach(async () => {
    // Assert no uncaught application errors occurred during test execution
    expect(pageErrors, `Uncaught page errors occurred: ${pageErrors.map((e) => e.message).join("; ")}`).toEqual([]);
  });

  test("loads /replay/demo, renders canvas, DEMO DATA badge, drivers, and controls", async ({ page }) => {
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

    await page.goto("/replay/demo", { waitUntil: "domcontentloaded" });

    // 1. Check DEMO DATA badge in top center
    const demoBadge = page.getByText("DEMO DATA", { exact: false });
    await expect(demoBadge.first()).toBeVisible({ timeout: 45_000 });

    // 2. Check track canvas is mounted
    const canvasContainer = page.locator("[data-testid='replay-canvas']");
    await expect(canvasContainer).toBeAttached({ timeout: 45_000 });

    // 3. Check drivers appear in list and select VER (overview remains default)
    const verDriverBtn = page.getByRole("button", { name: /Select.*VER/i }).first();
    await expect(verDriverBtn).toBeVisible({ timeout: 20_000 });
    await verDriverBtn.click();
    await expect(page.getByText("Select a driver to see telemetry")).not.toBeVisible();

    // Verify explicit follow control is present for selected driver
    const followVerBtn = page.getByRole("button", { name: /Follow VER/i }).first();
    await expect(followVerBtn).toBeVisible({ timeout: 5000 });
    await followVerBtn.click();
    await expect(page.getByText(/Following: VER/i)).toBeVisible();

    // Verify returning to full-circuit overview via Overview button
    const overviewBtn = page.getByRole("button", { name: /Return to full-circuit overview/i }).first();
    await expect(overviewBtn).toBeVisible({ timeout: 5000 });
    await overviewBtn.click();
    await expect(page.getByText(/Following: VER/i)).not.toBeVisible();

    // 4. Test Play/Pause toggle with explicit state verification
    const playPauseBtn = page.getByRole("button", { name: /^(Play|Pause) replay/i }).first();
    await expect(playPauseBtn).toBeVisible({ timeout: 10_000 });
    // Verify initially paused
    await expect(playPauseBtn).toHaveAttribute("aria-pressed", "false");

    // Click to start playing
    await playPauseBtn.click();
    // Verify state transitioned to playing
    await expect(playPauseBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /Pause replay/i }).first()).toBeVisible();

    // Click again to pause
    await playPauseBtn.click();
    // Verify state transitioned back to paused
    await expect(playPauseBtn).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: /Play replay/i }).first()).toBeVisible();

    // 5. Test speed controls (1x, 2x, 4x)
    const speed2xBtn = page.getByRole("button", { name: "2x" });
    if (await speed2xBtn.isVisible()) {
      await speed2xBtn.click();
      await expect(speed2xBtn).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("Speed x2")).toBeVisible();
    }
    const speed4xBtn = page.getByRole("button", { name: "4x" });
    if (await speed4xBtn.isVisible()) {
      await speed4xBtn.click();
      await expect(speed4xBtn).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("Speed x4")).toBeVisible();
    }

    // 6. Test camera controls (Zoom in, Zoom out, Reset view)
    const zoomInBtn = page.getByRole("button", { name: "Zoom in" });
    await expect(zoomInBtn).toBeVisible({ timeout: 5000 });
    await zoomInBtn.click();

    const zoomOutBtn = page.getByRole("button", { name: "Zoom out" });
    await expect(zoomOutBtn).toBeVisible({ timeout: 5000 });
    await zoomOutBtn.click();

    const resetViewBtn = page.getByRole("button", { name: "Reset camera view" });
    await expect(resetViewBtn).toBeVisible({ timeout: 5000 });
    await resetViewBtn.click();

    // 7. Test timeline slider seek
    const slider = page.getByRole("slider").first();
    if (await slider.isVisible()) {
      await slider.focus();
      await page.keyboard.press("ArrowRight");
    }
  });

  test("displays authentication error card on restricted session and navigates to demo", async ({ page }) => {
    await page.route("**/api/replay/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/2026/")) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "Real telemetry data is unavailable because Formula 1 restricted unauthenticated access.",
          }),
        });
      }
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

    await page.goto("/replay/2026/Singapore%20Grand%20Prix/R", { waitUntil: "domcontentloaded" });

    // 1. Verify error card appears and explains authentication restriction
    await expect(page.getByText("Real Telemetry Unavailable")).toBeVisible({ timeout: 35_000 });
    await expect(page.getByText("Formula 1 restricted unauthenticated access", { exact: false })).toBeVisible({ timeout: 10_000 });

    // 2. Click "Launch Demo Replay"
    const launchDemoBtn = page.getByRole("button", { name: "Launch Demo Replay" });
    await expect(launchDemoBtn).toBeVisible();
    await launchDemoBtn.click();

    // 3. Verify URL changed to demo
    await expect(page).toHaveURL(/\/replay\/demo/);
  });
});
