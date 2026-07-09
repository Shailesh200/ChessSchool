import { test, expect } from "@playwright/test";

/** M-059 — core flows at design mockup phone width (390×844). */
test.describe("mobile layout @390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("campus uses bottom nav and single-column layout", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
  });

  test("journey navigates directly on node tap", async ({ page }) => {
    await page.goto("/class/class-pieces");
    await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
    await page.getByRole("button", { name: "The Battlefield" }).click();
    await expect(page).toHaveURL(/\/lesson\//);
  });

  test("settings stacks sections without sidebar nav", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("navigation", { name: "Settings sections" }),
    ).toBeHidden();
    await expect(page.getByText("Sound effects")).toBeVisible();
  });

  test("no horizontal overflow on primary routes", async ({ page }) => {
    const routes = [
      "/",
      "/class/class-pieces",
      "/play",
      "/dashboard",
      "/plan",
      "/journal",
      "/library",
      "/settings",
    ];
    for (const route of routes) {
      await page.goto(route);
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow, `${route} should not scroll horizontally`).toBeLessThanOrEqual(
        1,
      );
    }
  });
});
