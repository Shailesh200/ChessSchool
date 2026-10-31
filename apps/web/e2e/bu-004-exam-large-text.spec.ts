import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** BU-004: class exam (`09-class-exam`) must fit at 200% root text — no overflow or clipped CTAs. */
const EXAM_ROUTE = "/class/class-pieces/exam";

type Box = { x: number; y: number; width: number; height: number };

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const VIEWPORTS = [
  { label: "320", width: 320, height: 568 },
  { label: "360", width: 360, height: 640 },
  { label: "390", width: 390, height: 844 },
  { label: "430", width: 430, height: 932 },
  { label: "1280", width: 1280, height: 800 },
  { label: "1440", width: 1440, height: 900 },
] as const;

async function applyLargeText(page: Page) {
  await page.waitForFunction(() => {
    const root = document.documentElement;
    if (root.dataset.largeText !== "1") return false;
    const px = parseFloat(getComputedStyle(root).fontSize);
    return px >= 30;
  }, { timeout: 15_000 });
}

async function box(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

async function assertNoHorizontalScroll(page: Page) {
  const ok = await page.evaluate(() => {
    const nodes = [
      document.documentElement,
      document.body,
      document.querySelector('[data-testid="lesson-stage"][data-screen="exam"]'),
      document.querySelector('[data-testid="lesson-scroll"]'),
    ].filter(Boolean) as HTMLElement[];
    return nodes.every((el) => el.scrollWidth <= el.clientWidth + 1);
  });
  expect(ok).toBe(true);
}

async function assertNotClipped(page: Page, selector: string) {
  const loc = page.locator(selector).first();
  await expect(loc).toBeVisible();
  const ok = await loc.evaluate((el) => {
    const cs = getComputedStyle(el);
    const canScroll =
      cs.overflowY === "auto" ||
      cs.overflowY === "scroll" ||
      cs.overflow === "auto" ||
      cs.overflow === "scroll";
    if (el.scrollHeight <= el.clientHeight + 1) return true;
    if (!canScroll) return false;
    const before = el.scrollTop;
    el.scrollTop = el.scrollHeight;
    const reached = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    el.scrollTop = before;
    return reached;
  });
  expect(ok).toBe(true);
}

async function assertExamLayout(page: Page) {
  await assertNoHorizontalScroll(page);
  await assertNotClipped(page, '[data-testid="lesson-stage"][data-screen="exam"] .cs-h3');
  await assertNotClipped(page, '[data-testid="lesson-coach-bubble"]');
  await assertNotClipped(page, '[data-testid="lesson-tip"]');

  const scroll = page.getByTestId("lesson-scroll");
  const scBox = await box(page, '[data-testid="lesson-scroll"]');
  const vp = page.viewportSize();
  const frameW = await page.getByTestId("lesson-board-frame").evaluate((el) => {
    return el.getBoundingClientRect().width;
  });
  if ((vp?.width ?? 0) < 900) {
    expect(frameW).toBeGreaterThanOrEqual(scBox.width * 0.85 - 2);
  } else {
    expect(frameW).toBeGreaterThanOrEqual(Math.min(520, scBox.width * 0.22));
  }

  for (const scrollTop of [0, 99999]) {
    await scroll.evaluate((el, top) => {
      el.scrollTop = top === 99999 ? el.scrollHeight : 0;
    }, scrollTop);
    await page.waitForTimeout(120);
    const board = await box(page, '[data-testid="lesson-board-frame"]');
    const action = await box(page, '[data-testid="lesson-drill-bar"] .cs-btn');
    expect(intersects(action, board)).toBe(false);
  }

  await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(150);
  for (const sq of ["a1", "h1"]) {
    await page.locator(`[data-square="${sq}"]`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    const sqBox = await box(page, `[data-square="${sq}"]`);
    const sc = await box(page, '[data-testid="lesson-scroll"]');
    expect(sqBox.y).toBeGreaterThanOrEqual(sc.y - 6);
    expect(sqBox.y + sqBox.height).toBeLessThanOrEqual(sc.y + sc.height + 2);
  }
}

test.describe("BU-004 class exam @200% large text (production)", () => {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`${theme} theme`, () => {
      test.beforeEach(async ({ context }) => {
        await context.addInitScript((appTheme) => {
          localStorage.setItem(
            "chessschool.settings",
            JSON.stringify({
              state: {
                uiKit: "premium",
                appTheme,
                textScale: 2,
              },
              version: 12,
            }),
          );
        }, theme === "dark" ? "midnight" : "default");
      });

      for (const vp of VIEWPORTS) {
        test(`${vp.label}×${vp.height}: no horizontal scroll, board + CTA`, async ({
          page,
        }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(EXAM_ROUTE, { waitUntil: "domcontentloaded" });
          await expect(
            page.locator('[data-testid="lesson-stage"][data-screen="exam"]'),
          ).toBeVisible();
          await expect(page.getByTestId("lesson-scroll")).toBeVisible();
          await applyLargeText(page);
          await expect(page.locator('[data-square="a1"]').first()).toBeVisible();
          await page.waitForTimeout(250);
          await assertExamLayout(page);
        });
      }
    });
  }
});
