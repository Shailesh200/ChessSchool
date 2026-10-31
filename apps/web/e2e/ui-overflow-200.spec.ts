import { test, expect, type Page } from "@playwright/test";
import { enrollWeb } from "./helpers/auth";

/**
 * RS-UI-01 / UI P0 cluster — 200% text must reflow, never scroll sideways.
 * In-app "200% text" is `textScale: 2` (html font-size 200%). Tailwind
 * breakpoints are rem media queries (browser default), so they do NOT react
 * to it; every rem-sized width/height doubles. These tests fail if a rigid row,
 * fixed-height/no-wrap Button, fixed 3-col grid or non-wrapping flex row returns
 * (UI-W-002, UI-W-006, UI-W-009, UI-W-019).
 */
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
] as const;

// Register once per worker: 9 viewports x register would trip the API rate limit
// (429) when this file runs alongside the rest of the e2e suite.
let session: { token: string; name: string } | undefined;
async function signIn(page: Page) {
  if (!session) {
    // The register bucket (10/min) is shared with every other spec; back off on 429.
    for (let attempt = 0; ; attempt++) {
      try {
        const { token, name } = await enrollWeb(page, {
          email: `e2e-overflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`,
        });
        session = { token, name };
        return;
      } catch (err) {
        if (attempt >= 6 || !String(err).includes("429")) throw err;
        await page.waitForTimeout(12_000);
      }
    }
  }
  const { token, name } = session;
  await page.context().addCookies([
    {
      name: "chessschool_session",
      value: token,
      url: process.env.BASE_URL || "http://localhost:3210",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.addInitScript((userName) => {
    localStorage.setItem(
      "chessschool.session",
      JSON.stringify({
        state: {
          authed: true,
          user: { name: userName, role: "student" },
          isAdmin: false,
        },
        version: 0,
      }),
    );
  }, name);
}

async function setTextScale(
  page: Page,
  textScale: number,
  uiKit?: "legacy" | "premium",
) {
  await page.addInitScript(
    ({ scale, kit }) => {
      const state: { textScale: number; uiKit?: string } = { textScale: scale };
      // Only the signed-in cases opt into Classic. Public pages stay on the
      // default premium kit (v12). Forcing legacy here shows both kit logos,
      // because `hidden` loses to the image preflight when the premium logo
      // rules do not match.
      if (kit) state.uiKit = kit;
      localStorage.setItem(
        "chessschool.settings",
        JSON.stringify({ state, version: 12 }),
      );
    },
    { scale: textScale, kit: uiKit ?? null },
  );
}

async function overflowReport(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const clippedButtons = [...document.querySelectorAll<HTMLElement>(".btn-tactile")]
      .filter(
        (el) =>
          el.getClientRects().length > 0 && getComputedStyle(el).overflow === "hidden",
      )
      .filter(
        (el) =>
          el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
      )
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`,
      );
    const hubLabelsClipped = [
      ...document.querySelectorAll<HTMLElement>("a.btn-tactile.flex-col"),
    ]
      .filter((tile) => {
        const label = [...tile.querySelectorAll<HTMLElement>("span")].pop();
        if (!label) return false;
        // Measure the rendered text (not the span box, which is clamped to the
        // tile): a long word that overflows its tile spills into the neighbour.
        const range = document.createRange();
        range.selectNodeContents(label);
        const text = range.getBoundingClientRect();
        const box = tile.getBoundingClientRect();
        return text.left < box.left - 1 || text.right > box.right + 1;
      })
      .map((tile) => (tile.textContent ?? "").trim());
    const track = document.querySelector<HTMLElement>("header .h-2\\.5");
    const trackVisible = !!track && track.getClientRects().length > 0;
    return {
      sideways: de.scrollWidth - de.clientWidth,
      clippedButtons,
      hubTiles: document.querySelectorAll("a.btn-tactile.flex-col").length,
      hubLabelsClipped,
      progressTrackWidth: trackVisible
        ? Math.round(track!.getBoundingClientRect().width)
        : null,
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`200% text @${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    for (const route of [
      "/",
      "/learn-chess",
      "/offline",
      "/does-not-exist",
      "/login",
    ]) {
      test(`${route} has no sideways scroll or clipped buttons`, async ({ page }) => {
        await setTextScale(page, 2);
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        const r = await overflowReport(page);
        expect(r.sideways, `sideways scroll on ${route}`).toBeLessThanOrEqual(0);
        expect(r.clippedButtons, "buttons whose label is clipped").toEqual([]);
      });
    }

    test("landing hero image stays inside the viewport", async ({ page }) => {
      await setTextScale(page, 2);
      await page.goto("/");
      const img = page.getByAltText("Cody, your chess coach mascot");
      await expect(img).toBeVisible();
      const box = await img.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
    });

    test("signed-in /profile and /academy reflow (hub labels, TopBar track)", async ({
      page,
    }) => {
      test.setTimeout(150_000);
      await signIn(page);
      await setTextScale(page, 2, "legacy");
      for (const route of ["/profile", "/academy"]) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        const r = await overflowReport(page);
        expect(r.sideways, `sideways scroll on ${route}`).toBeLessThanOrEqual(0);
        // Campus-map class cards used md:/lg: (rem) columns, so at 200% they stayed
        // 3-up and the "Test to unlock"/"Test out" buttons clipped (UI-W-009 family).
        expect(r.clippedButtons, "buttons whose label is clipped").toEqual([]);
        if (route === "/profile") expect(r.hubTiles).toBeGreaterThanOrEqual(4);
        expect(r.hubLabelsClipped, "hub tile labels wider than their tile").toEqual([]);
        // The TopBar is `lg:hidden` (>= 1024px), so below that the track must exist
        // and must not be squeezed to a sliver (UI-W-019). A null here is a failure,
        // not a skip: it would mean the bar or track vanished or is hidden.
        if (vp.width < 1024) {
          expect(
            r.progressTrackWidth,
            `TopBar track missing at ${vp.width}px`,
          ).not.toBeNull();
        }
        if (r.progressTrackWidth !== null) {
          expect(r.progressTrackWidth).toBeGreaterThanOrEqual(40);
        }
      }
    });
  });
}

// UI-W-002: signed-out landing at 200% root text. The header "Enroll free"
// control must sit fully inside the viewport, and the document must not scroll
// sideways. (The hero CTA is "Enroll free →" and may sit below the fold.)
for (const vp of [
  { width: 1280, height: 800 },
  { width: 320, height: 640 },
] as const) {
  test.describe(`UI-W-002 / @${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test("signed-out landing keeps Enroll free on screen", async ({ page }) => {
      await setTextScale(page, 2);
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const r = await overflowReport(page);
      expect(
        r.sideways,
        "document scrollWidth exceeds clientWidth",
      ).toBeLessThanOrEqual(0);
      expect(r.clippedButtons, "buttons whose label is clipped").toEqual([]);
      const cta = page.getByRole("button", { name: "Enroll free", exact: true });
      await expect(cta).toBeVisible();
      const box = await cta.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.y).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
    });
  });
}
