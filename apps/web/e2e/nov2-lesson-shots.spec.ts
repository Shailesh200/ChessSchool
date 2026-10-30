import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = join(__dirname, "../../../docs/nov2/shots");
const KIT = join(__dirname, "../../../design-kit/screens");
const WIDTHS = [390, 1280] as const;

const KIT_SCREENS: Array<{ id: string; file: string }> = [
  { id: "05a-lesson-intro", file: "05a-lesson-intro.html" },
  { id: "05b-lesson-drill", file: "05b-lesson-drill.html" },
  { id: "05c-lesson-tap-squares", file: "05c-lesson-tap-squares.html" },
  { id: "05d-lesson-why-quiz", file: "05d-lesson-why-quiz.html" },
  { id: "06a-bar-correct", file: "06a-bar-correct.html" },
  { id: "06b-bar-wrong", file: "06b-bar-wrong.html" },
  { id: "07-hint", file: "07-hint.html" },
  { id: "08-lesson-complete", file: "08-lesson-complete.html" },
];

const APP_ROUTES: Array<{ id: string; path: string; setup?: (page: import("@playwright/test").Page) => Promise<void> }> =
  [
    { id: "kit-showcase", path: "/dev/kit-showcase" },
    { id: "05a-lesson-intro", path: "/lesson/pawn-power" },
    {
      id: "05b-lesson-drill",
      path: "/lesson/pawn-power",
      setup: async (page) => {
        const gotIt = page.getByTestId("lesson-got-it");
        if (await gotIt.isVisible()) await gotIt.click();
        await page.getByTestId("lesson-drill-bar").waitFor({ timeout: 15_000 });
      },
    },
  ];

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

for (const w of WIDTHS) {
  test.describe(`nov2 shots @${w}px`, () => {
    test.use({ viewport: { width: w, height: w === 390 ? 844 : 800 } });

    for (const kit of KIT_SCREENS) {
      test(`kit HTML ${kit.id}`, async ({ page }) => {
        await page.goto(`file://${join(KIT, kit.file)}`);
        await page.waitForTimeout(400);
        await page.screenshot({
          path: join(OUT, `kit-${kit.id}-${w}.png`),
          fullPage: true,
        });
      });
    }

    for (const route of APP_ROUTES) {
      test(`web app ${route.id}`, async ({ page }) => {
        await page.goto(route.path);
        if (route.setup) await route.setup(page);
        await page.waitForTimeout(500);
        await page.screenshot({
          path: join(OUT, `web-${route.id}-${w}.png`),
          fullPage: true,
        });
      });
    }
  });
}
