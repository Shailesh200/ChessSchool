import { test, expect } from "@playwright/test";

/** M-073 Web GA trust / marketing pages. */

test("about page renders", async ({ page }) => {
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "About ChessSchool", level: 1 }),
  ).toBeVisible();
});

test("support page renders", async ({ page }) => {
  await page.goto("/support");
  await expect(page.getByRole("heading", { name: "Support", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /iamshailesh121@gmail.com/i }),
  ).toBeVisible();
});

test("terms page renders", async ({ page }) => {
  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: "Terms of Use", level: 1 }),
  ).toBeVisible();
});

test("chess-for-beginners landing renders", async ({ page }) => {
  await page.goto("/chess-for-beginners");
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("landing footer links trust pages", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "About" }),
  ).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Support" }),
  ).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Terms" }),
  ).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }),
  ).toBeVisible();
});
