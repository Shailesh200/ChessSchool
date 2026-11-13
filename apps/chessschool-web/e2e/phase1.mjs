// Phase 1 walkthrough: drives the real flows and saves screenshots.
// Usage: node e2e/phase1.mjs [outDir]   (web on :3100, API on :3300)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const apiBase = process.env.CHESSSCHOOL_API_URL ?? "";
if (apiBase.toLowerCase().includes("chess-school.in")) {
  console.error("refusing to run: API base URL must be a local server");
  process.exit(1);
}
const OUT = process.argv[2] ?? "/tmp/cs-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const log = (...a) => console.log("•", ...a);
const fail = (msg) => {
  console.error("✗", msg);
  process.exitCode = 1;
};
async function shot(page, name) {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  if (sw > w) fail(`${name}: horizontal overflow (${sw}px > ${w}px)`);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}
async function expectText(page, text) {
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 6000 });
  } catch {
    fail(`missing text: ${text} on ${page.url()}`);
  }
}

async function mobileFlow(scheme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
  const page = await ctx.newPage();
  const p = `m-${scheme}`;
  // First launch opens the login screen.
  await page.goto(BASE + "/");
  await page.waitForURL("**/login", { timeout: 8000 });
  await expectText(page, "Log in to pick up where you left off.");
  await shot(page, `${p}-01-login`);
  await page.getByRole("link", { name: "Keep going as a guest" }).click();
  await page.waitForURL("**/today");
  await expectText(page, "friend");
  await expectText(page, "Meet the school");
  await page.waitForTimeout(900);
  await shot(page, `${p}-06-today-new`);

  await page.getByRole("link", { name: "Begin" }).click();
  await page.waitForURL("**/orientation");
  await page.waitForTimeout(600);
  await shot(page, `${p}-07-orient-1`);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await shot(page, `${p}-08-orient-3`);
  await page.getByRole("button", { name: "I've got it" }).click();
  await page.waitForTimeout(1200);
  await expectText(page, "Welcome to the school!");
  await shot(page, `${p}-09-orient-done`);
  await page.getByRole("button", { name: "Back to Learn" }).click();
  await page.waitForURL("**/today");
  await page.waitForTimeout(1300);
  await shot(page, `${p}-10-today-done-notif`);
  const later = page.getByRole("button", { name: "Not now" });
  if (await later.isVisible()) await later.click();
  else fail("first-run notification sheet did not appear");
  await expectText(page, "10 XP");
  await expectText(page, "1 day");
  await shot(page, `${p}-11-today-done`);

  // Restart: progress must survive a reload.
  await page.reload();
  await expectText(page, "10 XP");
  const sheetAgain = await page.getByRole("button", { name: "Not now" }).isVisible().catch(() => false);
  if (sheetAgain) fail("notification sheet shown twice");

  // Phase 3: Rooms became the Gym; Club (still locked) keeps "Remind me".
  await page.getByRole("link", { name: "Gym" }).last().click();
  await page.waitForURL("**/gym");
  await page.waitForTimeout(400);
  await shot(page, `${p}-12-gym`);
  await page.goto(BASE + "/rooms/club");
  await expectText(page, "Club opens when friends can join you");

  await page.getByRole("link", { name: "Profile" }).last().click();
  await page.waitForURL("**/you");
  await page.getByRole("button", { name: /Edit name/ }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Asha");
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expectText(page, "Nice to meet you, Asha.");
  await page.getByRole("button", { name: /^Daily goal/ }).click();
  await page.getByRole("dialog").getByRole("radio", { name: "10 min" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await shot(page, `${p}-13-you-guest`);

  await page.getByRole("link", { name: "Settings" }).first().click();
  await page.waitForURL("**/settings");
  await shot(page, `${p}-14-settings`);
  await page.getByRole("button", { name: "Reset this device" }).click();
  await page.waitForTimeout(400);
  await shot(page, `${p}-15-reset-sheet`);
  await page.getByRole("button", { name: "Keep everything" }).click();

  // Sign up keeps the guest's name and orientation.
  await page.goto(BASE + "/signup");
  await page.getByRole("button", { name: "Create account" }).click();
  await expectText(page, "That email doesn't look right");
  await page.waitForTimeout(300);
  await shot(page, `${p}-16-signup-errors`);
  const email = `asha+${scheme}${Date.now()}@example.com`;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("pawnpawn1");
  await page.getByRole("button", { name: "Show password" }).click();
  await shot(page, `${p}-17-signup-filled`);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/today", { timeout: 10000 });
  await expectText(page, "Your progress is saved.");
  await expectText(page, "Asha");
  await page.waitForTimeout(900);
  await shot(page, `${p}-18-today-saved`);
  await page.reload();
  await expectText(page, "10 XP");

  await page.goto(BASE + "/you");
  await expectText(page, "Member");
  await expectText(page, email);
  await shot(page, `${p}-19-you-member`);

  // Sign out, then log back in with a wrong and a right password.
  await page.goto(BASE + "/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/today");
  await page.goto(BASE + "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("wrongpass");
  await page.getByRole("button", { name: "Log in" }).click();
  await expectText(page, "don't match");
  await shot(page, `${p}-20-login-error`);
  await page.getByLabel("Password", { exact: true }).fill("pawnpawn1");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/today");
  await expectText(page, "Your progress is saved.");

  // Reset device returns to a fresh welcome.
  await page.goto(BASE + "/settings");
  await page.waitForLoadState("networkidle");
  await shot(page, `${p}-21-settings-member`);
  await page.getByRole("button", { name: "Reset this device" }).click();
  await page.getByRole("button", { name: "Clear this device" }).click();
  await page.waitForURL("**/welcome");
  await page.goto(BASE + "/today");
  await expectText(page, "Meet the school");
  await expectText(page, "0 XP");
  log(`mobile ${scheme}: flow ok`);
  await ctx.close();
}

async function seeded(viewport, scheme, opts = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: opts.reducedMotion ?? "no-preference" });
  if (opts.apiDown) await ctx.route("**/v1/**", (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(BASE + "/welcome");
  await page.evaluate(() => {
    const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const t = day(new Date());
    localStorage.setItem(
      "chessschool.v2.state",
      JSON.stringify({
        version: 2,
        guestId: "seed",
        seenWelcome: true,
        profile: { name: "Asha", who: "me", dailyMinutes: 10 },
        prefs: { appearance: "system", sound: false, haptics: true, notifications: "dismissed" },
        progress: { completed: { meet: t }, xp: 10, streak: { count: 1, lastDay: t }, minutes: { day: t, value: 2 } },
        account: null,
        pendingCeremony: null,
        roomReminders: [],
        notificationOffered: true,
      }),
    );
  });
  return { ctx, page };
}

async function desktop(scheme) {
  const { ctx, page } = await seeded({ width: 1440, height: 900 }, scheme);
  for (const route of ["today", "gym", "puzzles", "you", "settings"]) {
    await page.goto(`${BASE}/${route}`);
    await page.waitForTimeout(900);
    await shot(page, `d-${scheme}-${route}`);
  }
  log(`desktop ${scheme}: captured`);
  await ctx.close();
}

async function tablet() {
  const { ctx, page } = await seeded({ width: 900, height: 1180 }, "light");
  await page.goto(`${BASE}/today`);
  await page.waitForTimeout(900);
  await shot(page, "t-light-today");
  await ctx.close();
}

async function reducedMotion() {
  const { ctx, page } = await seeded({ width: 390, height: 844 }, "light", { reducedMotion: "reduce" });
  await page.goto(`${BASE}/orientation`);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "I've got it" }).click();
  await page.waitForTimeout(500);
  await shot(page, "rm-orient-done");
  const animating = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
  if (animating > 0) fail(`reduced motion: ${animating} CSS animations still running`);
  log("reduced motion: ok");
  await ctx.close();
}

async function apiDown() {
  const { ctx, page } = await seeded({ width: 390, height: 844 }, "light", { apiDown: true });
  await page.goto(`${BASE}/today`);
  await expectText(page, "servers aren't answering");
  await expectText(page, "Your path");
  await shot(page, "x-api-down-today");
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Email").fill("a@b.co");
  await page.getByLabel("Password", { exact: true }).fill("pawnpawn1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expectText(page, "can't reach ChessSchool");
  await shot(page, "x-api-down-signup");
  await page.goto(`${BASE}/definitely-not-here`);
  await expectText(page, "This page isn't in the school.");
  await shot(page, "x-404");
  log("api down + 404: ok");
  await ctx.close();
}

try {
  await mobileFlow("light");
  await mobileFlow("dark");
  await desktop("light");
  await desktop("dark");
  await tablet();
  await reducedMotion();
  await apiDown();
} catch (e) {
  fail(e.message);
} finally {
  await browser.close();
}
console.log(process.exitCode ? "FAILED" : "ALL OK", "→", OUT);
