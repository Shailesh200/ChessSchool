import { test, expect } from "@playwright/test";

/** Midnight (premium + appTheme midnight) must paint lesson shell with kit semantic tokens. */
const DARK_BG = "rgb(23, 48, 43)"; /* --cs-bg #17302B */
const LEGACY_SURFACE = "rgb(20, 21, 43)"; /* legacy --surface (bg-surface) */

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

  test("lesson stage uses kit bg (not legacy bg-surface)", async ({ page }) => {
    await page.goto("/lesson/pawn-power", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        document.documentElement.dataset.uiKit === "premium" &&
        document.documentElement.dataset.theme === "dark",
      { timeout: 20_000 },
    );
    const stage = page.getByTestId("lesson-stage");
    await expect(stage).toBeVisible();
    const probe = await stage.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        hasLegacySurface: el.classList.contains("bg-surface"),
        bg: cs.backgroundColor,
      };
    });
    expect(probe.hasLegacySurface).toBe(false);
    expect(probe.bg).toBe(DARK_BG);
    expect(probe.bg).not.toBe(LEGACY_SURFACE);
  });
});
