import { test, expect, type Page } from "@playwright/test";
import { enrollWeb } from "./helpers/auth";

/**
 * W-H4: after logout the service worker must not replay the previous user's
 * signed-in HTML (`/account`) or API data offline. This spec needs a *real*
 * registered, controlling service worker, so SWs are explicitly allowed here.
 */
test.use({ serviceWorkers: "allow" });

/** Every cached request URL (path + search) across all Cache Storage buckets. */
async function cachedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const out: string[] = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const req of await cache.keys()) {
        const u = new URL(req.url);
        out.push(`${key} ${u.pathname}${u.search}`);
      }
    }
    return out;
  });
}

async function waitForControllingSw(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

function isPrivate(entry: string) {
  return /\s\/(account|api)(\/|\?|$)/.test(entry);
}

test("W-H4: after logout, offline /account does not show the previous user", async ({
  page,
  context,
}) => {
  const stamp = Date.now();
  const name = `Leakcheck Student ${stamp}`;
  const email = `wh4-${stamp}@test.dev`;
  await enrollWeb(page, { name, email });

  // Signed in: /account renders this user's identity and the SW takes control.
  await page.goto("/account");
  await expect(page.getByText(name).first()).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  await waitForControllingSw(page);

  // Visit /account again *through* the SW (first load wasn't controlled) and hit
  // an API route, so a caching SW would have both in Cache Storage.
  await page.goto("/account");
  await expect(page.getByText(name).first()).toBeVisible();
  const api = await page.evaluate(async () => (await fetch("/api/progress")).status);
  expect(api).toBe(200);
  expect((await cachedPaths(page)).filter(isPrivate)).toEqual([]);

  // Log out through the UI.
  await page
    .getByRole("button", { name: /^Log out$/ })
    .first()
    .click();
  await page.waitForURL("**/login");

  // Runtime caches hold nothing user-specific after logout.
  expect((await cachedPaths(page)).filter(isPrivate)).toEqual([]);
  expect(
    (await cachedPaths(page)).filter((e) => /-runtime\s/.test(e) && isPrivate(e)),
  ).toEqual([]);

  // Offline: the previous user's page must not come back from any cache.
  await context.setOffline(true);
  try {
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: /You.re offline/ })).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain(name);
    expect(html).not.toContain(email);
  } finally {
    await context.setOffline(false);
  }
});

test("W-H4: public pages still work offline through the service worker", async ({
  page,
  context,
}) => {
  await page.goto("/academy");
  await waitForControllingSw(page);
  await page.goto("/academy");
  await expect(page.getByText("Daily goal")).toBeVisible();

  await context.setOffline(true);
  try {
    await page.goto("/academy");
    await expect(page.getByText("Daily goal")).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
