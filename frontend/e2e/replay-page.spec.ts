import { test, expect } from "@playwright/test";

test.describe("Replay Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept metadata endpoint
    await page.route("**/api/replay/**/metadata", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          info: {
            year: 2024,
            event: "Bahrain",
            sessionType: "R",
            sessionName: "Race",
            totalLaps: 57,
          },
          drivers: [
            {
              abbreviation: "VER",
              teamName: "Red Bull Racing",
              teamColor: "#3671C6",
              driverNumber: "1",
            },
            {
              abbreviation: "HAM",
              teamName: "Mercedes",
              teamColor: "#27F4D2",
              driverNumber: "44",
            },
          ],
          circuit: {
            x: [0, 50, 100, 150, 200],
            y: [0, 20, 40, 30, 0],
            minX: 0,
            maxX: 200,
            minY: 0,
            maxY: 40,
          },
          totalLaps: 57,
          duration: 5400,
          frameInterval: 0.5,
          frameCount: 10800,
        }),
      });
    });

    // Intercept full replay / frames endpoint
    await page.route("**/api/replay/**", async (route) => {
      if (route.request().url().includes("/metadata") || route.request().url().includes("/frame/")) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          info: {
            year: 2024,
            event: "Bahrain",
            sessionType: "R",
            sessionName: "Race",
            totalLaps: 57,
          },
          drivers: [
            { abbreviation: "VER", teamName: "Red Bull Racing", teamColor: "#3671C6", driverNumber: "1" },
          ],
          circuit: {
            x: [0, 50, 100],
            y: [0, 20, 0],
            minX: 0,
            maxX: 100,
            minY: 0,
            maxY: 20,
          },
          frames: [
            {
              timestamp: 0.0,
              lap: 1,
              drivers: [
                {
                  driverId: "VER",
                  x: 0,
                  y: 0,
                  speed: 280,
                  gear: 7,
                  throttle: 100,
                  brake: false,
                  rpm: 11000,
                  drs: 0,
                  tyre: "MEDIUM",
                  lap: 1,
                  sector: 1,
                  position: 1,
                },
              ],
            },
          ],
          raceDuration: 5400,
        }),
      });
    });
  });

  test("renders dashboard panels and controls", async ({ page }) => {
    await page.goto("/replay/2024/Bahrain/R");

    // Verify main controls exist
    const playPauseBtn = page.getByRole("button", { name: /^(Play|Pause) replay/i });
    await expect(playPauseBtn).toBeVisible();

    // Verify speed controls
    const speed2x = page.getByRole("button", { name: "2x" });
    await expect(speed2x).toBeVisible();
    await speed2x.click();

    // Verify camera controls
    const zoomInBtn = page.getByRole("button", { name: "Zoom in" });
    await expect(zoomInBtn).toBeVisible();

    const resetCameraBtn = page.getByRole("button", { name: "Reset camera view" });
    await expect(resetCameraBtn).toBeVisible();

    // Verify driver is rendered in the timing tower
    await expect(page.getByText("VER", { exact: true })).toBeVisible();
  });
});
