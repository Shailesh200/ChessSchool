// Chaukor + Sunset walkthrough: a fresh visitor gets Sunset and the first lesson; log in leads to Today; the mascot plays lesson-complete on the done screen and
// streak-danger on Today in the evening; a stored Classroom theme survives a reload. Saves screenshots.
// Usage: node e2e/v3-mascot.mjs [outDir]   (web on :3551, API on :3550; both local)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../packages/chessschool-chess/package.json", import.meta.url));
const { Chess } = require("chess.js");

const BASE = process.env.BASE_URL ?? "http://localhost:3551";
const API = process.env.CHESSSCHOOL_API_URL ?? "http://localhost:3550";
if (![BASE, API].every((u) => /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u))) {
  console.error("refusing to run: web and API must be local servers");
  process.exit(1);
}
const OUT = process.argv[2] ?? "/tmp/cs-v3-mascot";
mkdirSync(OUT, { recursive: true });
const STATE = "chessschool.v2.state";
const browser = await chromium.launch({ channel: "chrome" });
const log = (...a) => console.log("•", ...a);
const fail = (msg) => {
  console.error("✗", msg);
  process.exitCode = 1;
};
const check = (ok, msg) => (ok ? log("ok:", msg) : fail(msg));
const sq = (page, s) => page.locator(`.board button[aria-label^="${s},"]`).first();
const ready = (page) => page.getByRole("button", { name: "Continue", exact: true }).isVisible();
const csTheme = (page) => page.evaluate(() => document.documentElement.dataset.csTheme ?? null);

/** Records which Chaukor clips the page fetched. */
function clips(page) {
  const seen = new Set();
  page.on("request", (r) => {
    const m = r.url().match(/\/assets\/lottie\/cody\/([a-z-]+)\.json/);
    if (m) seen.add(m[1]);
  });
  return seen;
}
const waitClip = async (seen, name, ms = 8000) => {
  for (let t = 0; t < ms && !seen.has(name); t += 100) await new Promise((r) => setTimeout(r, 100));
  return seen.has(name);
};
/** A Lottie player drew Chaukor (an <svg> inside the mascot slot). */
const drawn = (page, sel) => page.locator(`${sel} svg`).first().waitFor({ timeout: 8000 }).then(() => true, () => false);

async function solveStep(page) {
  if (await ready(page)) return;
  const k = await page.locator(".lesson-stage").getAttribute("data-kind");
  if (k === "choice") {
    for (const r of await page.locator(".choices [role=radio]").all()) {
      await r.click();
      if (await ready(page)) return;
    }
  } else if (k === "tap") {
    await page.getByRole("button", { name: "Show me" }).click();
    await page.locator(".board .is-hint").first().click();
  } else if (k === "move") {
    const c = new Chess(await page.locator(".board").first().getAttribute("data-fen"), { skipValidation: true });
    for (const m of c.moves({ verbose: true })) {
      await sq(page, m.from).click();
      await sq(page, m.to).click();
      if (await ready(page)) return;
    }
  }
  if (!(await ready(page))) fail(`could not solve ${k} step on ${page.url()}`);
}

async function freshVisitor() {
  log("fresh visitor: Sunset, first lesson, lesson complete");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const seen = clips(page);
  await page.goto(BASE);
  await page.waitForURL("**/lesson/board?first=1");
  await page.locator(".board").first().waitFor();
  check((await csTheme(page)) === "sunset", "a fresh visitor gets the Sunset theme");
  check(await drawn(page, ".lesson-stage"), "Chaukor draws in the lesson");
  await page.screenshot({ path: `${OUT}/01-first-lesson-sunset.png` });

  for (let n = 0; (await page.locator(".lesson-stage").isVisible()) && n < 30; n++) {
    await solveStep(page);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await page.locator(".seal-cody").waitFor();
  check(seen.has("correct"), "right answers play correct");
  check(await waitClip(seen, "lesson-complete"), "the done screen plays lesson-complete");
  check(await drawn(page, ".seal-cody"), "Chaukor draws on the done screen");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/02-lesson-complete.png` });
  await ctx.close();
}

async function haveAccount() {
  log("log in → Today");
  const email = `mascot-${Date.now()}@example.com`;
  const password = "chaukor-123";
  const res = await fetch(`${API}/v1/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Asha", email, password }) });
  check(res.status === 201, `account created (${res.status})`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForURL("**/lesson/board?first=1");
  // "I already have an account" is asked on the start screen now, before any lesson; go straight to log in.
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.locator("input[type=password]").fill(password);
  await page.screenshot({ path: `${OUT}/03-login.png` });
  await page.locator("form button[type=submit]").click();
  await page.waitForURL("**/today", { timeout: 15000 });
  await page.waitForTimeout(1500);
  check(page.url().endsWith("/today"), "after log in the learner lands on Today, not welcome");
  await ctx.close();
}

async function eveningStreak(scheme, theme) {
  log(`Today at 19:00 with the streak at risk (${theme}, ${scheme})`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
  const page = await ctx.newPage();
  const evening = new Date();
  evening.setHours(19, 0, 0, 0);
  await page.clock.setFixedTime(evening);
  const seen = clips(page);
  await page.goto(`${BASE}/welcome`);
  await page.getByRole("button", { name: "Skip" }).click().catch(() => {});
  await page.getByRole("button", { name: "Maybe later" }).click().catch(() => {});
  await page.waitForURL("**/today");
  const y = new Date(evening);
  y.setDate(y.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  await page.evaluate(
    ([key, day, theme, scheme]) => {
      const s = JSON.parse(localStorage.getItem(key));
      s.progress.streak = { count: 4, lastDay: day };
      s.progress.completed = { ...s.progress.completed, meet: day };
      s.notificationOffered = true;
      s.prefs.theme = theme;
      s.prefs.appearance = scheme;
      localStorage.setItem(key, JSON.stringify(s));
    },
    [STATE, yesterday, theme, scheme],
  );
  seen.clear();
  await page.reload();
  await page.locator(".today-cody").waitFor();
  check(await waitClip(seen, "streak-danger"), "the Today card plays streak-danger in the evening");
  check(await drawn(page, ".today-cody"), "Chaukor draws on Today");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/04-today-streak-danger-${theme}-${scheme}.png` });
  await ctx.close();
}

async function classroomSurvives() {
  log("a stored Classroom theme survives reload");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/welcome`);
  await page.getByRole("button", { name: "Skip" }).click().catch(() => {});
  await page.getByRole("button", { name: "Maybe later" }).click().catch(() => {});
  await page.waitForURL("**/today");
  await page.goto(`${BASE}/settings/looks`);
  const radios = page.locator('[role="radio"]');
  const first = (await radios.first().textContent()) ?? "";
  check(first.includes("Sunset"), `Sunset is first in the picker (${first.trim()})`);
  await page.screenshot({ path: `${OUT}/05-looks.png` });
  await radios.filter({ hasText: "Classroom" }).first().click();
  await page.waitForTimeout(500);
  check((await csTheme(page)) === null, "Classroom applied");
  await page.reload();
  await page.waitForTimeout(800);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).prefs.theme, STATE);
  check(stored === "classroom" && (await csTheme(page)) === null, `Classroom kept after reload (stored ${stored})`);
  await ctx.close();
}

await freshVisitor();
await haveAccount();
await eveningStreak("light", "sunset");
await eveningStreak("dark", "classroom");
await classroomSurvives();
await browser.close();
console.log(process.exitCode ? "FAILED" : "all checks passed", "→", OUT);
