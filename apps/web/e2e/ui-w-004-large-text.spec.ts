import { test, expect } from "./fixtures/legacyUiKit";
import type { Page } from "@playwright/test";

/** UI-W-004: long intro coach + homework board at 200% root text on narrow phones. */
const INTRO_ROUTE = "/lesson/pre-board-intro";
const HOMEWORK_ROUTE = "/homework/hw-practice-1";
const WIDTHS = [390, 360, 320] as const;
const ROOT_TEXT = 200;

type Box = { x: number; y: number; width: number; height: number };

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

async function openAt200(page: Page, route: string, waitBoard: boolean) {
  await page.goto(route);
  await page.evaluate((scale) => {
    document.documentElement.style.fontSize = `${scale}%`;
  }, ROOT_TEXT);
  await expect(page.getByTestId("lesson-scroll")).toBeVisible();
  if (waitBoard) {
    await expect(page.locator('[data-square="a1"]').first()).toBeVisible();
  }
  await page.waitForTimeout(200);
}

async function box(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

for (const width of WIDTHS) {
  test.describe(`UI-W-004 intro + homework @${width}px / ${ROOT_TEXT}% text`, () => {
    test.use({ viewport: { width, height: 844 } });

    test(`coach, board, and action stay separated on ${INTRO_ROUTE}`, async ({ page }) => {
      await openAt200(page, INTRO_ROUTE, true);
      const vh = await page.evaluate(() => window.innerHeight);

      const bubble = page.getByTestId("lesson-coach-bubble");
      const bubbleBox = await box(page, '[data-testid="lesson-coach-bubble"]');
      expect(bubbleBox.height).toBeLessThanOrEqual(vh * 0.5 + 1);

      const textOk = await bubble.evaluate((el) => {
        const cs = getComputedStyle(el);
        const clipped =
          el.scrollHeight > el.clientHeight + 1 &&
          cs.overflowY !== "auto" &&
          cs.overflowY !== "scroll";
        return !clipped;
      });
      expect(textOk).toBe(true);

      expect(await page.locator("[data-square]").count()).toBe(64);

      const footerPos = await page
        .locator(".lesson-stage-footer")
        .evaluate((el) => getComputedStyle(el).position);
      expect(footerPos).toBe("relative");

      await page.getByTestId("lesson-board-frame").scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);

      const board = await box(page, '[data-testid="lesson-board-frame"]');
      const action = await box(page, '[data-testid="lesson-got-it"]');
      expect(intersects(action, board)).toBe(false);

      const sc = await box(page, '[data-testid="lesson-scroll"]');
      expect(board.y).toBeGreaterThanOrEqual(sc.y - 1);
      expect(board.y + board.height).toBeLessThanOrEqual(sc.y + sc.height + 1);
    });

    test(`homework drill footer does not cover the board on ${HOMEWORK_ROUTE}`, async ({
      page,
    }) => {
      await openAt200(page, HOMEWORK_ROUTE, true);
      const vh = await page.evaluate(() => window.innerHeight);

      const bubbleBox = await box(page, '[data-testid="lesson-coach-bubble"]');
      expect(bubbleBox.height).toBeLessThanOrEqual(vh * 0.5 + 1);

      expect(await page.locator("[data-square]").count()).toBe(64);

      const footerPos = await page
        .locator(".lesson-stage-footer")
        .evaluate((el) => getComputedStyle(el).position);
      expect(footerPos).toBe("relative");

      await page.getByTestId("lesson-board-frame").scrollIntoViewIfNeeded();
      const board = await box(page, '[data-testid="lesson-board-frame"]');
      const action = await box(page, '[data-testid="lesson-drill-bar"] .cs-btn');
      expect(intersects(action, board)).toBe(false);
    });
  });
}
