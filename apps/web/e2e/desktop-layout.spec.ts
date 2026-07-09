import { test, expect } from "@playwright/test";

/** M-059 — core flows at desktop mockup width (1280×800). */
test.describe("desktop layout @1280", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("campus shows sidebar nav and multi-column class grid", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByText("Daily goal")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
  });

  test("journey shows lesson list panel", async ({ page }) => {
    await page.goto("/class/class-pieces");
    await expect(page.getByRole("navigation", { name: "Lesson list" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
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
});
