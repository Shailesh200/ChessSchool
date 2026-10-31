import { test, expect } from "@playwright/test";

/** Midnight (data-theme=dark) must paint lesson shell with kit semantic tokens. */
const DARK_BG = "rgb(23, 48, 43)"; /* --cs-bg #17302B */
const LEGACY_SURFACE = "rgb(20, 21, 43)"; /* app --surface in dark (bg-surface) */

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

  test("05a dev kit uses kit bg (not legacy bg-surface)", async ({ page }) => {
    await page.goto("/dev/lesson-kit?screen=05a", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-theme") === "dark",
      { timeout: 15_000 },
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
