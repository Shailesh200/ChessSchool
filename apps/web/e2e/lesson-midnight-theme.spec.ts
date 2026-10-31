import { test, expect } from "@playwright/test";

/** Midnight (data-theme=dark) must paint lesson shell with kit semantic tokens. */
const DARK_BG = "rgb(23, 48, 43)"; /* --cs-bg #17302B */
const DARK_BUBBLE = "rgb(31, 62, 55)"; /* --cs-coach-bubble #1F3E37 */

test.describe("lesson Midnight theme tokens", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.setItem(
        "chessschool.settings",
        JSON.stringify({
          state: { uiKit: "premium", appTheme: "midnight" },
          version: 12,
        }),
      );
    });
  });

  test("05a dev kit uses dark background and coach bubble colors", async ({ page }) => {
    await page.goto("/dev/lesson-kit?screen=05a", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-theme") === "dark",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("lesson-coach-bubble")).toBeVisible();
    const colors = await page.evaluate(() => {
      const stage = document.querySelector('[data-testid="lesson-stage"]') as HTMLElement;
      const bubble = document.querySelector(
        '[data-testid="lesson-coach-bubble"]',
      ) as HTMLElement;
      return {
        bg: getComputedStyle(stage).backgroundColor,
        bubble: getComputedStyle(bubble).backgroundColor,
      };
    });
    expect(colors.bg).toBe(DARK_BG);
    expect(colors.bubble).toBe(DARK_BUBBLE);
  });
});
