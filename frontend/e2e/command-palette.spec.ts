import { test, expect } from "@playwright/test";

test.describe("Command Palette E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/sessions/*/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("opens with keyboard shortcut Ctrl+K and closes with Escape", async ({ page }) => {
    await page.goto("/");

    // Initially command palette dialog should not exist
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).not.toBeVisible();

    // Trigger shortcut
    await page.keyboard.press("Control+KeyK");
    await expect(palette).toBeVisible();

    // Type a query in search box
    const searchInput = page.getByPlaceholder("Type a command…");
    await expect(searchInput).toBeFocused();
    await searchInput.fill("mode");

    // Check filtered results
    await expect(page.getByText("Enable compact mode")).toBeVisible();

    // Press Escape to dismiss
    await page.keyboard.press("Escape");
    await expect(palette).not.toBeVisible();
  });
});
