import { test, expect } from "@playwright/test";

/** Route smoke tests — each route in scripts/web-e2e-routes.json must be covered (≥90%). */

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /log in|sign in|welcome/i }),
  ).toBeVisible();
});

test("register page renders", async ({ page }) => {
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: /enroll|register|sign up|create/i }),
  ).toBeVisible();
});

test("privacy policy renders", async ({ page }) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Privacy Policy", level: 1 }),
  ).toBeVisible();
});

test("learn-chess landing renders", async ({ page }) => {
  await page.goto("/learn-chess");
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("library browse renders", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByText(/library|lessons|browse/i).first()).toBeVisible();
});

test("study plan renders", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.getByText(/study plan|daily|routine/i).first()).toBeVisible();
});

test("journal renders", async ({ page }) => {
  await page.goto("/journal");
  await expect(page.getByText(/journal|reflection|mistake/i).first()).toBeVisible();
});

test("playground renders", async ({ page }) => {
  await page.goto("/playground");
  await expect(page.getByText(/playground|position|sandbox/i).first()).toBeVisible();
});

test("placement test entry renders", async ({ page }) => {
  await page.goto("/placement");
  await expect(page).toHaveURL(/\/login\?next=\/placement/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});
