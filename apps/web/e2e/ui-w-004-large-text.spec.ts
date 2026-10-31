import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** UI-W-004: long intro + homework at 200% text — user-visible layout (production build). */
const INTRO_ROUTE = "/lesson/pre-board-intro";
const HOMEWORK_ROUTE = "/homework/hw-practice-1";

type Box = { x: number; y: number; width: number; height: number };

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

async function applyLargeText(page: Page) {
  await page.waitForFunction(() => {
    const root = document.documentElement;
    if (root.dataset.largeText !== "1") return false;
    const px = parseFloat(getComputedStyle(root).fontSize);
    return px >= 30;
  }, { timeout: 15_000 });
}

async function openLesson200(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("lesson-scroll")).toBeVisible();
  await applyLargeText(page);
  await expect(page.locator('[data-square="a1"]').first()).toBeVisible();
  await page.waitForTimeout(250);
}

async function box(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

async function assertCoachReadable(page: Page) {
  const bubble = page.getByTestId("lesson-coach-bubble");
  const vh = await page.evaluate(() => window.innerHeight);
  const bubbleBox = await box(page, '[data-testid="lesson-coach-bubble"]');
  expect(bubbleBox.height).toBeLessThanOrEqual(vh * 0.5 + 2);

  const coachOk = await bubble.evaluate((el) => {
    const cs = getComputedStyle(el);
    const canScrollInside =
      cs.overflowY === "auto" || cs.overflowY === "scroll";
    if (el.scrollHeight <= el.clientHeight + 2) return true;
    if (!canScrollInside) return false;
    const before = el.scrollTop;
    el.scrollTop = el.scrollHeight;
    const reached = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    el.scrollTop = before;
    return reached;
  });
  expect(coachOk).toBe(true);
}

async function assertBoardAndAction(page: Page, actionSelector: string) {
  const scroll = page.getByTestId("lesson-scroll");
  const scBox = await box(page, '[data-testid="lesson-scroll"]');
  const frameW = await page.getByTestId("lesson-board-frame").evaluate((el) => {
    return el.getBoundingClientRect().width;
  });
  expect(frameW).toBeGreaterThanOrEqual(scBox.width * 0.85 - 2);
  expect(await page.locator("[data-square]").count()).toBe(64);

  for (const scrollTop of [0, 99999]) {
    await scroll.evaluate((el, top) => {
      el.scrollTop = top === 99999 ? el.scrollHeight : 0;
    }, scrollTop);
    await page.waitForTimeout(120);

    const board = await box(page, '[data-testid="lesson-board-frame"]');
    const action = await box(page, actionSelector);
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
    const actionBox = await page.locator(actionSelector).boundingBox();
    if (actionBox) expect(intersects(actionBox, sqBox)).toBe(false);
  }
}

test.describe("UI-W-004 @200% large text (production)", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.setItem(
        "chessschool.settings",
        JSON.stringify({
          state: { uiKit: "premium", appTheme: "default", textScale: 2 },
          version: 12,
        }),
      );
    });
  });

  test("390×844 intro: coach, full-width board, Got it never on squares", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLesson200(page, INTRO_ROUTE);
    await assertCoachReadable(page);
    await assertBoardAndAction(page, '[data-testid="lesson-got-it"]');
  });

  test("320×568 intro: coach, board, Got it", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openLesson200(page, INTRO_ROUTE);
    await assertCoachReadable(page);
    await assertBoardAndAction(page, '[data-testid="lesson-got-it"]');
  });

  test("390×844 homework: board width and Check bar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLesson200(page, HOMEWORK_ROUTE);
    await assertCoachReadable(page);
    await assertBoardAndAction(page, '[data-testid="lesson-drill-bar"] .cs-btn');
  });

  test("390×844 kit hint line is not clipped at 200% text", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dev/lesson-kit?screen=07", { waitUntil: "domcontentloaded" });
    await applyLargeText(page);
    const tip = page.getByTestId("lesson-tip");
    await expect(tip).toBeVisible();
    const ok = await tip.evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
    expect(ok).toBe(true);
  });
});
