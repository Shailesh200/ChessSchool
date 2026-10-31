import { test, expect } from "./fixtures/legacyUiKit";
import type { Page } from "@playwright/test";

/**
 * Lesson player layout cluster (UI-W-004, UI-W-005, UI-M-003/004/005/018 on web).
 * One shared shell (features/lessons/LessonStage + .lesson-stage* CSS) owns the
 * geometry, so these assertions are made against that shell at every width and at
 * 200% text, not per screen. Each test name carries the item it guards.
 */
const VIEWPORTS: Array<[number, number]> = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [844, 390],
];
const SCALES = [100, 200];
const BOARD_ROUTE = "/lesson/pawn-power";
const QUIZ_ROUTE = "/lesson/pre-meet-pawn";

type Box = { x: number; y: number; width: number; height: number };

async function openLesson(page: Page, route: string, scale: number, board = true) {
  await page.goto(route);
  // Same mechanism as the app's own text-size bootstrap (html font-size %).
  if (scale !== 100) {
    await page.evaluate((s) => {
      document.documentElement.style.fontSize = `${s}%`;
    }, scale);
  }
  await expect(page.getByTestId("lesson-scroll")).toBeVisible();
  if (board) await expect(page.locator('[data-square="a1"]').first()).toBeVisible();
  await page.waitForTimeout(150);
}

async function box(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

async function overflowX(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const sc = document.querySelector('[data-testid="lesson-scroll"]') as HTMLElement;
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      scroller: sc.scrollWidth - sc.clientWidth,
    };
  });
}

for (const [w, h] of VIEWPORTS) {
  test.describe(`lesson layout @${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    for (const scale of SCALES) {
      test(`UI-W-004: no horizontal overflow, the page scrolls inside one scroller @${scale}%`, async ({
        page,
      }) => {
        for (const route of [BOARD_ROUTE, QUIZ_ROUTE]) {
          await page.goto(route);
          if (scale !== 100)
            await page.evaluate((s) => {
              document.documentElement.style.fontSize = `${s}%`;
            }, scale);
          await expect(page.getByTestId("lesson-scroll")).toBeVisible();
          await page.waitForTimeout(150);
          const o = await overflowX(page);
          expect(o.doc, `${route} document overflow`).toBeLessThanOrEqual(0);
          expect(o.scroller, `${route} scroller overflow`).toBeLessThanOrEqual(0);
          const overflowY = await page
            .getByTestId("lesson-scroll")
            .evaluate((el) => getComputedStyle(el).overflowY);
          expect(["auto", "scroll"]).toContain(overflowY);
          // The stage is exactly one dynamic viewport tall: the document itself
          // never grows past it (header/footer stay in place, the scroller scrolls).
          const docH = await page.evaluate(() => document.documentElement.scrollHeight);
          expect(docH).toBeLessThanOrEqual(h + 1);
        }
      });

      test(`UI-W-004/UI-M-003: coach bubble is height-capped with an internal scroll @${scale}%`, async ({
        page,
      }) => {
        await openLesson(page, BOARD_ROUTE, scale);
        const info = await page.getByTestId("lesson-coach-bubble").evaluate((el) => {
          const cs = getComputedStyle(el);
          const sc = document.querySelector(
            '[data-testid="lesson-scroll"]',
          ) as HTMLElement;
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
          return {
            maxHeight: cs.maxHeight,
            overflowY: cs.overflowY,
            height: el.getBoundingClientRect().height,
            scrollerH: sc.getBoundingClientRect().height,
            rem,
          };
        });
        expect(info.maxHeight).not.toBe("none");
        expect(info.overflowY).toBe("auto");
        const cap = parseFloat(info.maxHeight);
        expect(info.height).toBeLessThanOrEqual(cap + 1);
        // The cap can never let the bubble own the screen.
        expect(cap).toBeLessThanOrEqual(
          Math.max(0.65 * info.scrollerH, 9 * info.rem) + 1,
        );
      });

      test(`UI-W-004: board keeps its minimum size and is reachable @${scale}%`, async ({
        page,
      }) => {
        await openLesson(page, BOARD_ROUTE, scale);
        const frame = page.getByTestId("lesson-board-frame");
        const b0 = await box(page, '[data-testid="lesson-board-frame"]');
        // Never below 220px unless the screen itself is narrower than that.
        expect(b0.width).toBeGreaterThanOrEqual(Math.min(219, w - 16));
        expect(Math.abs(b0.width - b0.height)).toBeLessThanOrEqual(2);
        // A meaningful part of the board is on screen without scrolling...
        const sc0 = await box(page, '[data-testid="lesson-scroll"]');
        const visible =
          Math.min(b0.y + b0.height, sc0.y + sc0.height) - Math.max(b0.y, sc0.y);
        expect(visible).toBeGreaterThanOrEqual(Math.min(b0.height * 0.5, 120));
        // ...and after scrolling it fits fully inside the scroller (not under the
        // header/footer).
        await frame.scrollIntoViewIfNeeded();
        const b = await box(page, '[data-testid="lesson-board-frame"]');
        const sc = await box(page, '[data-testid="lesson-scroll"]');
        if (b.height <= sc.height) {
          expect(b.y).toBeGreaterThanOrEqual(sc.y - 1);
          expect(b.y + b.height).toBeLessThanOrEqual(sc.y + sc.height + 1);
        }
      });

      test(`UI-M-004: hint bar and controls never cover the board or rank 1 @${scale}%`, async ({
        page,
      }) => {
        await openLesson(page, BOARD_ROUTE, scale);
        await page.getByTestId("lesson-tip").scrollIntoViewIfNeeded();
        const board = await box(page, '[data-testid="lesson-board-frame"]');
        const rank1 = await page.locator('[data-square$="1"]').evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          }),
        );
        expect(rank1.length).toBeGreaterThanOrEqual(8);
        for (const sel of [
          '[data-testid="lesson-tip"]',
          '[data-testid="lesson-hint-bar"]',
        ]) {
          const bar = await box(page, sel);
          expect(intersects(bar, board), `${sel} vs board`).toBe(false);
          for (const sq of rank1)
            expect(intersects(bar, sq), `${sel} vs rank 1`).toBe(false);
        }
        // Normal flow, not an overlay.
        const pos = await page
          .getByTestId("lesson-tip")
          .evaluate((el) => getComputedStyle(el).position);
        expect(["static", "relative"]).toContain(pos);
      });

      test(`UI-M-005/UI-W-005: header and footer are in-flow bars, never overlaying content @${scale}%`, async ({
        page,
      }) => {
        for (const route of [BOARD_ROUTE, QUIZ_ROUTE]) {
          await openLesson(page, route, scale, route === BOARD_ROUTE);
          const header = await box(page, ".lesson-stage-header");
          const sc = await box(page, '[data-testid="lesson-scroll"]');
          const layout = await page.evaluate(() => {
            const scroll = document.querySelector(
              '[data-testid="lesson-scroll"]',
            ) as HTMLElement;
            const footer = document.querySelector(
              ".lesson-stage-footer",
            ) as HTMLElement;
            const grid = scroll?.querySelector(".lesson-stage-grid");
            const footerPos = footer ? getComputedStyle(footer).position : "";
            const follows =
              Boolean(grid && footer) &&
              (grid!.compareDocumentPosition(footer!) &
                Node.DOCUMENT_POSITION_FOLLOWING) !==
                0;
            return {
              footerInScroll: footer?.parentElement === scroll,
              follows,
              footerPos,
            };
          });
          expect(layout.footerInScroll).toBe(true);
          expect(layout.follows).toBe(true);
          expect(header.y + header.height).toBeLessThanOrEqual(sc.y + 1);
          expect(["static", "relative"]).toContain(layout.footerPos);
          expect(["sticky", "fixed"]).not.toContain(layout.footerPos);
        }
      });
    }
  });
}

test.describe("landscape and wide: board and panel side by side", () => {
  for (const [w, h] of [
    [900, 700],
    [844, 390],
    [1024, 768],
    [1440, 900],
  ] as Array<[number, number]>) {
    test(`UI-W-005/UI-M-018: board left, coach panel right @${w}x${h}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      await openLesson(page, BOARD_ROUTE, 100);
      const board = await box(page, '[data-testid="lesson-board-frame"]');
      const panel = await box(page, '[data-testid="lesson-coach-panel"]');
      expect(board.x + board.width).toBeLessThanOrEqual(panel.x + 1);
      // They share vertical space (side by side, not stacked).
      expect(board.y).toBeLessThan(panel.y + panel.height);
      expect(panel.y).toBeLessThan(board.y + board.height);
      // 844x390 used to give a ~150-190px board; now it gets the height.
      if (h <= 500) expect(board.width).toBeGreaterThanOrEqual(250);
      const sc = await box(page, '[data-testid="lesson-scroll"]');
      expect(board.y + board.height).toBeLessThanOrEqual(sc.y + sc.height + 1);
    });
  }

  test("UI-W-005: phone portrait stays stacked (coach above board)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLesson(page, BOARD_ROUTE, 100);
    const board = await box(page, '[data-testid="lesson-board-frame"]');
    const panel = await box(page, '[data-testid="lesson-coach-panel"]');
    expect(panel.y + panel.height).toBeLessThanOrEqual(board.y + 1);
  });

  test("UI-W-005: side-by-side layout starts at kit 900px width", async ({ page }) => {
    await page.setViewportSize({ width: 899, height: 800 });
    await openLesson(page, BOARD_ROUTE, 100);
    let board = await box(page, '[data-testid="lesson-board-frame"]');
    let panel = await box(page, '[data-testid="lesson-coach-panel"]');
    expect(panel.y + panel.height).toBeLessThanOrEqual(board.y + 1);

    await page.setViewportSize({ width: 900, height: 800 });
    await openLesson(page, BOARD_ROUTE, 100);
    board = await box(page, '[data-testid="lesson-board-frame"]');
    panel = await box(page, '[data-testid="lesson-coach-panel"]');
    expect(board.x + board.width).toBeLessThanOrEqual(panel.x + 1);
  });
});

test.describe("short landscape at 200% text: footer collapses (RS-UI-02)", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("UI-W-005: the Continue footer takes at most 20% of 844x390 @200% and the scroller keeps >=60% of the height", async ({
    page,
  }) => {
    // pre-meet-pawn opens on an info step, which shows the Continue card.
    await openLesson(page, QUIZ_ROUTE, 200);
    const cont = page.getByRole("button", { name: "Continue" });
    await expect(cont).toBeVisible();
    await page.waitForTimeout(400); // entrance spring settled
    const footer = await box(page, ".lesson-stage-footer");
    const sc = await box(page, '[data-testid="lesson-scroll"]');
    // Measured: 72px with the slim bar, 90px without it.
    expect(footer.height).toBeLessThanOrEqual(390 * 0.2);
    expect(sc.height).toBeGreaterThanOrEqual(390 * 0.6);
    // The button itself is fully inside the footer (nothing clipped).
    const b = await cont.boundingBox();
    expect(b!.y + b!.height).toBeLessThanOrEqual(footer.y + footer.height + 1);
  });
});
