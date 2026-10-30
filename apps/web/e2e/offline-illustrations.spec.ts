import { test, expect } from "./fixtures/legacyUiKit";

/**
 * UI-W-017: offline, illustrations were broken images. The empty-state SVGs
 * (/library, /review) and the /offline mascot (served by next/image as
 * /_next/image?url=...) were never in the service worker's precache. They must be
 * available from Cache Storage on the very first offline visit.
 */
test.use({ serviceWorkers: "allow" });

test("UI-W-017: empty-state SVGs and the /offline mascot render with no network", async ({
  page,
  context,
}) => {
  await page.goto("/offline");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await context.setOffline(true);
  try {
    // Through the (controlling) service worker, with the network cut.
    const svgs = await page.evaluate(async () => {
      const out: Record<string, number> = {};
      for (const p of ["/svg/empty/empty-library.svg", "/svg/empty/empty-review.svg"]) {
        try {
          out[p] = (await fetch(p)).status;
        } catch {
          out[p] = 0;
        }
      }
      return out;
    });
    expect(svgs).toEqual({
      "/svg/empty/empty-library.svg": 200,
      "/svg/empty/empty-review.svg": 200,
    });

    // The offline fallback page itself: every <img> decodes (no broken mascot).
    await page.reload();
    await expect(page.locator("img").first()).toBeVisible();
    await page.waitForFunction(() =>
      Array.from(document.images).every((i) => i.complete),
    );
    const broken = await page.evaluate(() =>
      Array.from(document.images)
        .filter((i) => i.naturalWidth === 0)
        .map((i) => i.currentSrc || i.src),
    );
    expect(broken).toEqual([]);
    const imgCount = await page.evaluate(() => document.images.length);
    expect(imgCount).toBeGreaterThan(0);
  } finally {
    await context.setOffline(false);
  }
});
