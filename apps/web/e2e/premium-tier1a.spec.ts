import { test, expect } from "@playwright/test";

test.describe("premium tier 1a", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "chessschool.settings",
        JSON.stringify({ state: { uiKit: "premium" }, version: 12 }),
      );
    });
  });

  test("splash renders illustrated hero", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/splash");
    await expect(page.locator('[data-screen="splash"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  });

  test("onboarding route requires auth (redirects when logged out)", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot password dex screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login/forgot");
    await expect(page.locator('[data-screen="19a-forgot-password"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  });
});
