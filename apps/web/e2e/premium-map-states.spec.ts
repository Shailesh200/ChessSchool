import { test, expect } from "@playwright/test";

test.describe("premium map states", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "chessschool.settings",
        JSON.stringify({ state: { uiKit: "premium" }, version: 12 }),
      );
    });
  });

  for (const state of ["offline", "empty", "loading", "error"] as const) {
    test(`academy premiumMap=${state}`, async ({ page }) => {
      await page.goto(`/academy?premiumMap=${state}`);
      await expect(page.locator(`section[data-screen="map-${state}"]`)).toBeVisible();
    });
  }
});
