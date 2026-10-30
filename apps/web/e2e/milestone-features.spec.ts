import { test, expect } from "./fixtures/legacyUiKit";
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

test("settings shows coach speech and the coach character list", async ({ page }) => {
  await page.goto("/settings");
  const coachSpeech = page.getByRole("switch", { name: /coach speech/i });
  await expect(coachSpeech).toBeVisible();
  if (!(await coachSpeech.isChecked())) {
    await coachSpeech.click();
  }
  await expect(page.getByText("Coach character")).toBeVisible();
  for (const name of ["Otto", "Kira", "Skye", "Ash", "Rex"]) {
    await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }
});

test("pre-school meet-the-pawn lesson renders", async ({ page }) => {
  await page.goto("/lesson/pre-meet-pawn");
  await expect(page.getByText(/pawn/i).first()).toBeVisible({ timeout: 10000 });
});
