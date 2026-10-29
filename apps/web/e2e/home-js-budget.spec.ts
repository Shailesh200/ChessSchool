import { test, expect } from "@playwright/test";

// Playwright compiles specs as CJS. This is the same helper the budget script uses.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const homeJs = require("../../../scripts/lib/home-initial-js.cjs") as {
  HOME_JS_BUDGET_KB: number;
  measureFirstLoadJs: (html: string) => { gzipBytes: number; kb: number };
  measureBuiltHome: () => { gzipBytes: number; kb: number };
};

/**
 * Playwright's home document vs the budget script, on the same build.
 * Both call `measureFirstLoadJs`, so the script set and gzip method cannot drift.
 */
test("home first-load JS matches the budget measurement", async ({ page }) => {
  const response = await page.goto("/");
  expect(response, "home document").toBeTruthy();
  const html = await response!.text();

  const live = homeJs.measureFirstLoadJs(html);
  const built = homeJs.measureBuiltHome();

  expect(Math.abs(live.gzipBytes - built.gzipBytes)).toBeLessThanOrEqual(1024);
  expect(live.kb).toBeLessThanOrEqual(homeJs.HOME_JS_BUDGET_KB);
});
