import { test, expect } from "@playwright/test";

test.describe("Error Boundary & 404 Pages", () => {
  test("renders 404 page for non-existent route", async ({ page }) => {
    await page.goto("/non-existent-page");
    await expect(page.locator("h1")).toContainText("404");
    await expect(page.getByRole("link", { name: "Back to race selector" })).toBeVisible();
  });

  test("renders error notification if season events fail to load", async ({ page }) => {
    await page.route("**/api/sessions/*/events", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal Server Error" }),
      });
    });

    await page.goto("/");
    const errorAlert = page.locator("p[role='alert']");
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText("Failed to load events");
  });
});
