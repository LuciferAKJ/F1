import { test, expect } from "@playwright/test";

test.describe("Error Boundary & 404 Pages", () => {
  test("renders 404 page for non-existent route", async ({ page }) => {
    await page.goto("/non-existent-page");
    await expect(page.locator("h1")).toContainText("404");
    await expect(page.getByRole("link", { name: "Back to race selector" })).toBeVisible();
  });

  test("renders error notification if season events fail to load", async ({ page }) => {
    await page.route("**/api/sessions/latest-available", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          year: 0,
          event: "Demo",
          sessionType: "R",
          roundNumber: 0,
          eventName: "Demo Grand Prix",
          country: "Sample Circuit",
          location: "Simulation",
          eventDate: "",
          isDemo: true,
          hasVerifiedRealSession: false,
          hasTelemetry: true,
          verified: true,
          status: "available",
          totalLaps: 57,
          driverCount: 3,
        }),
      });
    });

    await page.route("**/api/sessions/*/events**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal Server Error" }),
      });
    });

    await page.goto("/");
    const errorAlert = page.getByTestId("season-archive-selector").getByRole("alert");
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText("Unable to load the race schedule for season");
  });
});
