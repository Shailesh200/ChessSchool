import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 320, height: 640 } });

test("/account/reset without token shows help at 320", async ({ page }) => {
  await page.goto("/account/reset");
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("/account/reset rejects an invalid token at 320", async ({ page }) => {
  await page.goto("/account/reset?token=not-a-valid-reset-token");
  await page.getByLabel("New password").fill("newpassword1");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
