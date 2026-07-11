import { test, expect } from "@playwright/test";

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
    await expect(page.getByText("App theme")).toBeVisible();
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
