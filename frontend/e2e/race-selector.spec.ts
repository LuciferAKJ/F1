import { test, expect } from "@playwright/test";
import path from "path";

const MOCK_CIRCUIT = {
  x: [0, 200, 420, 480, 320, 120, -40, 0],
  y: [0, 40, 20, -180, -240, -140, -60, 0],
  minX: -40,
  maxX: 480,
  minY: -240,
  maxY: 40,
  rotation: 0,
  marshalSectors: [],
};

test.describe("Landing Page & Race Discovery", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/sessions/latest-available", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          year: 2026,
          event: "Azerbaijan Grand Prix",
          sessionType: "R",
          roundNumber: 17,
          eventName: "Azerbaijan Grand Prix",
          country: "Azerbaijan",
          location: "Baku",
          eventDate: "2026-09-26",
          isDemo: false,
          hasVerifiedRealSession: true,
          hasTelemetry: true,
          verified: true,
          status: "available",
          totalLaps: 51,
          driverCount: 22,
          circuit: MOCK_CIRCUIT,
        }),
      });
    });

    await page.route("**/api/sessions/*/events*", async (route) => {
      const url = new URL(route.request().url());
      const sessionType = url.searchParams.get("session_type") || "R";

      if (sessionType === "Q") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              roundNumber: 17,
              eventName: "Azerbaijan Grand Prix",
              country: "Azerbaijan",
              location: "Baku",
              eventDate: "2026-09-26",
              sessionType: "Q",
              status: "unverified",
              hasTelemetry: false,
              verified: false,
              verifiedSessions: ["R"],
              statusReason: "Session has not been verified or cached yet",
            },
          ]),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            roundNumber: 0,
            eventName: "Pre-Season Testing",
            country: "Bahrain",
            location: "Sakhir",
            eventDate: "2026-02-20",
            sessionType: "R",
            status: "restricted",
            hasTelemetry: false,
            verified: true,
            verifiedSessions: [],
            statusReason: "Testing session without championship race telemetry",
          },
          {
            roundNumber: 1,
            eventName: "Australian Grand Prix",
            country: "Australia",
            location: "Melbourne",
            eventDate: "2026-03-08",
            sessionType: "R",
            status: "unverified",
            hasTelemetry: false,
            verified: false,
            verifiedSessions: [],
            statusReason: "Session has not been verified or cached yet",
          },
          {
            roundNumber: 17,
            eventName: "Azerbaijan Grand Prix",
            country: "Azerbaijan",
            location: "Baku",
            eventDate: "2026-09-26",
            sessionType: "R",
            status: "available",
            hasTelemetry: true,
            verified: true,
            verifiedSessions: ["R"],
            totalLaps: 51,
            driverCount: 22,
            circuit: MOCK_CIRCUIT,
          },
          {
            roundNumber: 22,
            eventName: "Las Vegas Grand Prix",
            country: "United States",
            location: "Las Vegas",
            eventDate: "2026-11-21",
            sessionType: "R",
            status: "upcoming",
            hasTelemetry: false,
            verified: true,
            verifiedSessions: [],
            statusReason: "Scheduled for 2026-11-21",
          },
        ]),
      });
    });

    await page.route("**/api/sessions/*/*/R/availability*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          year: 2026,
          event: "Australian Grand Prix",
          eventName: "Australian Grand Prix",
          sessionType: "R",
          roundNumber: 1,
          country: "Australia",
          location: "Melbourne",
          eventDate: "2026-03-08",
          status: "available",
          hasTelemetry: true,
          eventExists: true,
          hasOccurred: true,
          sessionExists: true,
          sessionSupported: true,
          verified: true,
          verifiedSessions: ["R"],
          totalLaps: 58,
          driverCount: 20,
          circuit: MOCK_CIRCUIT,
          statusReason: "Telemetry verified in FastF1 availability check",
        }),
      });
    });
  });

  test("loads landing page with verified featured race, real circuit geometry, and no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.locator("header")).toContainText("F1 RACE REPLAY");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Formula 1 Race Replay");

    const featuredCard = page.getByTestId("featured-race-card");
    await expect(featuredCard).toBeVisible();
    await expect(featuredCard).toContainText("Azerbaijan Grand Prix");
    await expect(featuredCard).toContainText("REPLAY VERIFIED");
    await expect(featuredCard).toContainText("22 Drivers");
    await expect(featuredCard).toContainText("51 Laps");

    const circuitCard = page.getByTestId("circuit-preview-card");
    await expect(circuitCard).toBeVisible();
    await expect(page.getByTestId("verified-circuit-svg")).toBeVisible();
    await expect(circuitCard).not.toContainText("FIA Grade 1");

    const demoLink = page.getByRole("link", { name: /Watch Instant Demo/i });
    await expect(demoLink).toBeVisible();
    await expect(demoLink).toHaveAttribute("href", "/replay/demo");

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasOverflow).toBe(false);

    await page.screenshot({
      path: path.join(process.cwd(), "..", "docs", "screenshots", "landing_desktop_1440x900.png"),
      fullPage: true,
    });
  });

  test("supports search filtering, on-demand availability check, and unverified circuit state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // Select unverified Australian GP in archive
    const australianRow = page.getByTestId("event-row-1");
    await expect(australianRow).toBeVisible();
    await expect(australianRow).toContainText("Not Verified");

    // Click Australian Grand Prix name to preview its unavailable circuit state
    await australianRow.getByRole("button", { name: "Australian Grand Prix" }).click();
    await expect(page.getByTestId("circuit-preview-unavailable")).toBeVisible();
    await expect(page.getByTestId("featured-race-card")).toContainText("NOT VERIFIED");

    // Trigger on-demand Check availability from the row
    await australianRow.getByRole("button", { name: /Check availability/i }).click();
    await expect(australianRow).toContainText("Replay Ready");
    await expect(page.getByTestId("verified-circuit-svg")).toBeVisible();

    // Filter in Season Archive
    const searchInput = page.getByLabel("Filter Grand Prix events");
    await searchInput.fill("Azerbaijan");
    await expect(page.getByTestId("event-row-17")).toBeVisible();
    await expect(page.getByTestId("event-row-1")).not.toBeVisible();

    await page.getByLabel("Clear search").click();
    await expect(page.getByTestId("event-row-1")).toBeVisible();
  });

  test("switches session type to Qualifying and reflects session-specific availability", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const sessionTrigger = page.getByLabel("Select session type");
    await sessionTrigger.click();
    await page.getByRole("option", { name: /Qualifying \(Q\)/i }).click();

    const azerbaijanRow = page.getByTestId("event-row-17");
    await expect(azerbaijanRow).toContainText("Not Verified");
    await expect(azerbaijanRow).toContainText("Verified: R");
  });

  test("captures responsive viewports (Tablet & Mobile) without horizontal overflow", async ({ page }) => {
    // 1. Tablet Viewport (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await expect(page.getByTestId("featured-race-card")).toBeVisible();
    const tabletOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(tabletOverflow).toBe(false);
    await page.screenshot({
      path: path.join(process.cwd(), "..", "docs", "screenshots", "landing_tablet_768x1024.png"),
      fullPage: true,
    });

    // 2. Mobile Viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("featured-race-card")).toBeVisible();
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(mobileOverflow).toBe(false);
    await page.screenshot({
      path: path.join(process.cwd(), "..", "docs", "screenshots", "landing_mobile_390x844.png"),
      fullPage: true,
    });
  });
});
