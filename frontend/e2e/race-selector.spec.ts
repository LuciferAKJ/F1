import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Landing Page & Race Discovery", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept latest-available API
    await page.route("**/api/sessions/latest-available", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          year: 2024,
          event: "Bahrain Grand Prix",
          sessionType: "R",
          roundNumber: 1,
          eventName: "Bahrain Grand Prix",
          country: "Bahrain",
          location: "Sakhir",
          eventDate: "2024-03-02",
          isDemo: false,
          hasTelemetry: true,
          status: "available",
        }),
      });
    });

    // Intercept season events API
    await page.route("**/api/sessions/*/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            roundNumber: 0,
            eventName: "Pre-Season Testing",
            country: "Bahrain",
            location: "Sakhir",
            eventDate: "2024-02-23",
            status: "restricted",
            hasTelemetry: false,
          },
          {
            roundNumber: 1,
            eventName: "Bahrain Grand Prix",
            country: "Bahrain",
            location: "Sakhir",
            eventDate: "2024-03-02",
            status: "available",
            hasTelemetry: true,
          },
          {
            roundNumber: 2,
            eventName: "Saudi Arabian Grand Prix",
            country: "Saudi Arabia",
            location: "Jeddah",
            eventDate: "2024-03-09",
            status: "available",
            hasTelemetry: true,
          },
          {
            roundNumber: 3,
            eventName: "Australian Grand Prix",
            country: "Australia",
            location: "Melbourne",
            eventDate: "2024-03-24",
            status: "upcoming",
            hasTelemetry: false,
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

  test("loads spectator-first landing page with hero, featured race and circuit preview", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // Verify main header and brand
    await expect(page.locator("header")).toContainText("F1 RACE REPLAY");

    // Verify hero section
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Formula 1 Race Replay");

    // Verify featured race card
    const featuredCard = page.getByTestId("featured-race-card");
    await expect(featuredCard).toBeVisible();
    await expect(featuredCard).toContainText("Bahrain Grand Prix");
    await expect(featuredCard).toContainText("REPLAY VERIFIED");

    // Verify circuit preview card
    const circuitCard = page.getByTestId("circuit-preview-card");
    await expect(circuitCard).toBeVisible();
    await expect(circuitCard).toContainText("Bahrain International Circuit");
    await expect(circuitCard).toContainText("Turns");
    await expect(circuitCard).toContainText("DRS Zones");

    // Verify instant demo link in hero
    const demoLink = page.getByRole("link", { name: /Watch Instant Demo/i });
    await expect(demoLink).toBeVisible();
    await expect(demoLink).toHaveAttribute("href", "/replay/demo");

    // Save desktop screenshot
    await page.screenshot({
      path: path.join(process.cwd(), "..", "docs", "screenshots", "landing_desktop_1440x900.png"),
      fullPage: true,
    });
  });

  test("filters events in season archive and selects event for circuit preview", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // Locate search filter in Season Archive
    const searchInput = page.getByLabel("Filter Grand Prix events");
    await expect(searchInput).toBeVisible();

    // Type query to filter
    await searchInput.fill("Saudi");
    await expect(page.getByTestId("event-row-2")).toBeVisible();
    await expect(page.getByTestId("event-row-1")).not.toBeVisible();

    // Clear search
    const clearBtn = page.getByLabel("Clear search");
    await clearBtn.click();
    await expect(page.getByTestId("event-row-1")).toBeVisible();
  });

  test("captures responsive viewports (Tablet & Mobile)", async ({ page }) => {
    // 1. Tablet Viewport (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await expect(page.getByTestId("featured-race-card")).toBeVisible();
    await page.screenshot({
      path: path.join(process.cwd(), "..", "docs", "screenshots", "landing_tablet_768x1024.png"),
      fullPage: true,
    });

    // 2. Mobile Viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("featured-race-card")).toBeVisible();
    await page.screenshot({
      path: path.join(process.cwd(), "..", "docs", "screenshots", "landing_mobile_390x844.png"),
      fullPage: true,
    });
  });
});
