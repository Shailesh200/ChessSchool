import { test, expect, type Page } from "@playwright/test";

/**
 * M-072 visual regression — guest-safe routes at Pixel 7 (playwright.config).
 * Update baselines intentionally:
 *   pnpm --filter web e2e -- visual.spec.ts --update-snapshots
 */
test.describe.configure({ timeout: 60_000 });

const ROUTES: {
  path: string;
  name: string;
  ready: (page: Page) => Promise<void>;
  /** Extra pixel tolerance for dense/dynamic surfaces (campus map). */
  maxDiffPixelRatio?: number;
}[] = [
  {
    path: "/",
    name: "landing",
    ready: async (page) => {
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    },
  },
  {
    path: "/login",
    name: "login",
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    },
  },
  {
    path: "/academy",
    name: "academy",
    maxDiffPixelRatio: 0.08,
    ready: async (page) => {
      await expect(page.getByText("Daily goal")).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Your place in school" }),
      ).toBeVisible();
    },
  },
  {
    path: "/themes",
    name: "themes",
    ready: async (page) => {
      await expect(page.getByText("Theme Studio")).toBeVisible();
    },
  },
  {
    path: "/settings",
    name: "settings",
    ready: async (page) => {
      await expect(page.locator("#settings-sound")).toBeVisible();
    },
  },
];

async function settle(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForLoadState("domcontentloaded");
  // Let client hydration finish before snapshot.
  await page.waitForTimeout(400);
}

for (const route of ROUTES) {
  test(`visual: ${route.name} (${route.path})`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await settle(page);
    await route.ready(page);
    // Pixel baselines are authored on darwin Chrome. Ubuntu CI Chromium differs
    // enough in fonts/AA to flake; landmarks above are the CI gate. Run
    // `pnpm --filter web e2e -- visual.spec.ts` locally (or with
    // FORCE_VISUAL_SCREENSHOTS=1) for screenshot diffs.
    if (process.env.CI && process.env.FORCE_VISUAL_SCREENSHOTS !== "1") {
      return;
    }
    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: route.maxDiffPixelRatio ?? 0.02,
      animations: "disabled",
    });
  });
}
