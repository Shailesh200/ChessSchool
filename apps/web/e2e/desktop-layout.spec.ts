import { test, expect } from "./fixtures/legacyUiKit";

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

  test("play shows the premium hub", async ({ page }) => {
    await page.goto("/play");
    await expect(page.getByRole("heading", { name: "Play", level: 1 })).toBeVisible();
    await expect(page.getByText("How do you want to play?")).toBeVisible();
    await expect(page.getByText("Pick who to play")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
    await page.getByRole("radio", { name: /Friend/ }).click();
    await expect(page.getByText("Pass and play")).toBeVisible();
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
    await page.getByRole("button", { name: "Start game" }).click();
    await expect(page.getByRole("button", { name: "Resign" })).toBeVisible();

    const board = page.getByTestId("chess-board");
    await expect(board).toBeVisible();
    const box = await board.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(560);

    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.getByText("Thinking…")).toBeHidden({ timeout: 8000 });
  });
});

/** Phone width, same spec file so a desktop pin regression cannot hide here. */
test.describe("play CTAs @390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Start game stays pinned above the tab bar", async ({ page }) => {
    await page.goto("/play");
    const start = page.getByRole("button", { name: "Start game" });
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(start).toBeVisible();
    const startBox = await start.boundingBox();
    const navBox = await nav.boundingBox();
    expect(startBox).toBeTruthy();
    expect(navBox).toBeTruthy();
    expect(startBox!.y + startBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
  });
});
