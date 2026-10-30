import { test, expect } from "./fixtures/legacyUiKit";
import type { Page } from "@playwright/test";

/** M-059 — core flows at desktop mockup width (1280×800). */
test.describe("desktop layout @1280", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("campus shows sidebar nav and multi-column class grid", async ({ page }) => {
    await page.goto("/academy");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByText("Daily goal")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
  });

  test("journey shows lesson list and preview panel", async ({ page }) => {
    await page.goto("/class/class-pieces");
    await expect(page.getByRole("navigation", { name: "Lesson list" })).toBeVisible();
    await expect(page.getByLabel("Lesson preview")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
  });

  test("plan uses two-column homework layout", async ({ page }) => {
    await page.goto("/plan");
    await expect(
      page.getByRole("heading", { name: "Homework", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Today's homework")).toBeVisible();
    await expect(page.getByText("Choose your pace")).toBeVisible();
  });

  test("journal shows entry detail panel", async ({ page }) => {
    await page.goto("/journal");
    await expect(
      page.getByRole("heading", { name: "Learning Journal", level: 1 }),
    ).toBeVisible();
    await expect(page.getByLabel("Journal entry detail")).toBeVisible();
  });

  test("no horizontal overflow on primary routes", async ({ page }) => {
    const routes = [
      "/",
      "/academy",
      "/class/class-pieces",
      "/play",
      "/dashboard",
      "/plan",
      "/journal",
      "/library",
      "/settings",
      "/themes",
    ];
    for (const route of routes) {
      await page.goto(route);
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow, `${route} should not scroll horizontally`).toBeLessThanOrEqual(
        1,
      );
    }
  });

  test("settings shows section nav", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("navigation", { name: "Settings sections" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Sound effects")).toBeVisible();
  });

  test("play shows match preview panel", async ({ page }) => {
    await page.goto("/play");
    await expect(page.getByText("Match preview")).toBeVisible();
    await expect(page.getByRole("heading", { name: "New match" })).toBeVisible();
    await expectInlineChooserCta(page, "Start match");
    await page.getByRole("button", { name: /vs Human/ }).click();
    await expectInlineChooserCta(page, "Start (one device)");
    const oneDevice = await page
      .getByRole("button", { name: "Start (one device)", exact: true })
      .boundingBox();
    const online = await page
      .getByRole("button", { name: /Play a friend online|Enroll to play online/ })
      .boundingBox();
    expect(online!.y).toBeGreaterThan(oneDevice!.y + oneDevice!.height - 1);
  });

  test("dashboard uses two-column skill layout", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Report Card", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Skill tree")).toBeVisible();
    await expect(page.getByText("Activity")).toBeVisible();
  });

  test("library uses app shell on desktop", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your Library", level: 1 }),
    ).toBeVisible();
  });

  test("themes uses two-column studio layout", async ({ page }) => {
    await page.goto("/themes");
    await expect(
      page.getByRole("heading", { name: "Theme Studio", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Live preview")).toBeVisible();
    await expect(page.getByRole("heading", { name: "App theme" })).toBeVisible();
  });

  test("play match board is capped and moves work at desktop width", async ({
    page,
  }) => {
    await page.goto("/play");
    await page.getByRole("button", { name: "Start match" }).click();
    await expect(page.getByRole("button", { name: "Resign" })).toBeVisible();

    const board = page.getByTestId("chess-board");
    await expect(board).toBeVisible();
    const box = await board.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(520);

    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.getByText("Thinking…")).toBeHidden({ timeout: 8000 });
  });
});

/** Phone width, same spec file so a desktop pin regression cannot hide here. */
test.describe("play CTAs @390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Start match and Start (one device) stay pinned above the tab bar", async ({
    page,
  }) => {
    await page.goto("/play");
    await expectPinnedChooserCta(page, "Start match");
    await page.getByRole("button", { name: /vs Human/ }).click();
    await expectPinnedChooserCta(page, "Start (one device)");
  });
});

async function chooserCtaLayout(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeVisible();
  const detail = await button.evaluate((el) => {
    const positions = [getComputedStyle(el).position];
    let node = el.parentElement;
    while (node && !node.classList.contains("play-chooser")) {
      positions.push(getComputedStyle(node).position);
      node = node.parentElement;
    }
    const rect = el.getBoundingClientRect();
    const label = [...document.querySelectorAll("p")].find(
      (p) => p.textContent?.trim() === "Time control",
    );
    let card: HTMLElement | null = label?.parentElement ?? null;
    while (card && !card.className.includes("rounded-card")) card = card.parentElement;
    return {
      positions,
      top: rect.top,
      bottom: rect.bottom,
      cardBottom: card ? card.getBoundingClientRect().bottom : null,
    };
  });
  return { button, detail };
}

/** Desktop: the control itself is in normal flow, directly under Time control. */
async function expectInlineChooserCta(page: Page, name: string) {
  const { detail } = await chooserCtaLayout(page, name);
  expect(detail.positions, name).not.toContain("sticky");
  expect(detail.positions, name).not.toContain("fixed");
  expect(detail.cardBottom, `${name} time control`).not.toBeNull();
  const gap = detail.top - (detail.cardBottom ?? 0);
  expect(gap, `${name} sits under time control`).toBeGreaterThanOrEqual(0);
  expect(gap, `${name} sits under time control`).toBeLessThanOrEqual(28);
}

/** Phone: pinned (sticky or fixed) and still fully above the tab bar after scroll. */
async function expectPinnedChooserCta(page: Page, name: string) {
  const nav = page.getByRole("navigation", { name: "Primary" });
  const before = await chooserCtaLayout(page, name);
  const navBefore = await nav.boundingBox();
  expect(navBefore).toBeTruthy();
  expect(
    before.detail.positions.some((pos) => pos === "sticky" || pos === "fixed"),
    name,
  ).toBe(true);
  expect(before.detail.top).toBeGreaterThanOrEqual(0);
  expect(before.detail.bottom).toBeLessThanOrEqual(navBefore!.y + 1);

  await page.evaluate(() => {
    document.querySelectorAll("*").forEach((el) => {
      if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 2) {
        el.scrollTop = el.scrollHeight;
      }
    });
  });

  const after = await chooserCtaLayout(page, name);
  const navAfter = await nav.boundingBox();
  expect(Math.abs(after.detail.top - before.detail.top)).toBeLessThan(2);
  expect(after.detail.bottom).toBeLessThanOrEqual((navAfter?.y ?? 844) + 1);
  expect(after.detail.cardBottom, `${name} time control`).not.toBeNull();
  expect(after.detail.cardBottom ?? 0).toBeLessThanOrEqual(after.detail.top + 1);
}
