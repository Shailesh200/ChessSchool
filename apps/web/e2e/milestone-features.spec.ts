import { test, expect } from "@playwright/test";
import { enrollWeb } from "./helpers/auth";

test("arena hub renders standings and start controls", async ({ page }) => {
  await enrollWeb(page);
  await page.goto("/play/arena");
  await expect(page.getByRole("heading", { name: /arena tournament/i })).toBeVisible();
  await expect(page.getByText(/standings|score|round/i).first()).toBeVisible();
});

test("calculation trainer loads at /play/think", async ({ page }) => {
  await enrollWeb(page);
  await page.goto("/play/think");
  await expect(page.getByRole("heading", { name: /lesson trainer/i })).toBeVisible();
  await expect(page.getByText(/coach/i).first()).toBeVisible();
});

test("settings coach voice picker shows coach and narrator groups", async ({
  page,
}) => {
  await page.goto("/settings");
  const coachSpeech = page.getByRole("switch", { name: /coach voice/i });
  if (!(await coachSpeech.isChecked())) {
    await coachSpeech.click();
  }
  await expect(page.getByText("Coaches")).toBeVisible();
  await expect(page.getByText("Narrators")).toBeVisible();
  await expect(page.getByRole("button", { name: /Grant/i })).toBeVisible();
});

test("pre-school meet-the-pawn lesson renders", async ({ page }) => {
  await page.goto("/lesson/pre-meet-pawn");
  await expect(page.getByText(/pawn/i).first()).toBeVisible({ timeout: 10000 });
});
