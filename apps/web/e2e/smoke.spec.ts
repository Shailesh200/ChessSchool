import { test, expect } from "@playwright/test";

test("campus map renders resume card, semesters and classes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Daily goal")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Your place in school" })).toBeVisible();
  await expect(page.getByText("Foundations").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
});

test("class journey shows the milestone path", async ({ page }) => {
  await page.goto("/class/class-pieces");
  await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
  await expect(page.getByText(/lessons/)).toBeVisible();
  await expect(page.getByText("The Battlefield")).toBeVisible();
});

test("theme studio shows app + board themes with live preview", async ({ page }) => {
  await page.goto("/themes");
  await expect(page.getByText("Theme Studio")).toBeVisible();
  await expect(page.getByText("Live preview")).toBeVisible();
  await expect(page.getByText("App theme")).toBeVisible();
  await expect(page.getByText("Board themes")).toBeVisible();
  // switching to Midnight applies a dark surface
  await page.getByText("🌙 Midnight").click();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "midnight");
});

test("dashboard shows skill tree and mistake DNA", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Skill tree")).toBeVisible();
  await expect(page.getByText("Mistake DNA")).toBeVisible();
});

test("settings renders (data tools are logged-in only)", async ({ page }) => {
  await page.goto("/settings");
  // Guests see the settings page but NOT the personal data export/import section.
  await expect(page.getByText("Sound & Feel")).toBeVisible();
  await expect(page.getByRole("button", { name: /Export backup/ })).toHaveCount(0);
});

test("lesson loads with coach narration", async ({ page }) => {
  await page.goto("/lesson/pawn-power");
  await expect(page.getByText(/Push your e-pawn/i)).toBeVisible();
});

test("play: choose a mode, start a match, and the bot replies", async ({ page }) => {
  await page.goto("/play");
  await expect(page.getByText("New match")).toBeVisible();
  await page.getByRole("button", { name: "Start match" }).click();

  // Focus mode: top action bar shows Resign, nav is hidden.
  await expect(page.getByRole("button", { name: "Resign" })).toBeVisible();

  // Make e2-e4; the bot should reply (Thinking… then a coach line).
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await expect(page.getByText("Thinking…")).toBeHidden({ timeout: 5000 });
});

test("review tab shows match history section", async ({ page }) => {
  await page.goto("/review");
  await expect(page.getByText("Match history")).toBeVisible();
});

test("settings exposes accessibility controls", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Reduce motion")).toBeVisible();
  await expect(page.getByText("Coach personality")).toBeVisible();
});
