import { test, expect } from "@playwright/test";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "../lib/password-reset-messages";

test.use({ viewport: { width: 320, height: 640 } });

test("login → Forgot password? → email form, no sideways scroll at 320", async ({
  page,
}) => {
  await page.goto("/login");
  const link = page.getByRole("link", { name: "Forgot password?" });
  await expect(link).toBeVisible();
  const noSideways = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  await noSideways();

  await link.click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Forgot your password?", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  await noSideways();
});

test("/forgot-password submits email and shows generic confirmation at 320", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Email" }).fill("nobody@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(PASSWORD_RESET_GENERIC_MESSAGE)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
