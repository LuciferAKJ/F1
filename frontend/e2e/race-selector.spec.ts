import { test, expect } from "@playwright/test";

test.describe("Race Selector Page", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept season events API to avoid external network reliance
    await page.route("**/api/sessions/*/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            roundNumber: 1,
            eventName: "Bahrain Grand Prix",
            country: "Bahrain",
            location: "Sakhir",
            eventDate: "2024-03-02",
          },
          {
            roundNumber: 2,
            eventName: "Saudi Arabian Grand Prix",
            country: "Saudi Arabia",
            location: "Jeddah",
            eventDate: "2024-03-09",
          },
        ]),
      });
    });

    await page.route("**/api/replay/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    });
  });

  test("loads selector UI and navigates to replay page on selection", async ({ page }) => {
    await page.goto("/");

    // Verify main header
    await expect(page.locator("h1")).toContainText("F1 Race Replay");

    // The Grand Prix select trigger should exist
    const gpTrigger = page.getByRole("combobox", { name: "Grand Prix" });
    await expect(gpTrigger).toBeVisible();

    // "Load Replay" button should be disabled initially until an event is chosen
    const loadButton = page.getByRole("button", { name: "Load Replay" });
    await expect(loadButton).toBeDisabled();

    // Open Grand Prix select
    await gpTrigger.click();

    // Select the first option: Bahrain Grand Prix
    const bahrainOption = page.getByRole("option", { name: /Bahrain Grand Prix/i });
    await expect(bahrainOption).toBeVisible();
    await bahrainOption.click();

    // Button should now be enabled
    await expect(loadButton).toBeEnabled();

    // Click load replay and verify navigation URL
    await Promise.all([
      page.waitForURL(/\/replay\/\d+\/Bahrain%20Grand%20Prix\/R/),
      loadButton.click(),
    ]);
  });
});
