// Track B (habit loop) walkthrough: lesson summary (English and Hindi) with the combo meter, the
// mate of the day and its share text, and the weekly league (guest card, then a signed-in table).
// Usage: node e2e/v3-habit.mjs [outDir]   (web on BASE_URL, default :3521, with its API on a local database)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../packages/chessschool-chess/package.json", import.meta.url));
const { Chess } = require("chess.js");

const BASE = process.env.BASE_URL ?? "http://localhost:3521";
if (BASE.includes("chess-school.in")) {
  console.error("refusing to run against production");
  process.exit(1);
}
const OUT = process.argv[2] ?? "/tmp/cs-v3-habit";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const log = (...a) => console.log("•", ...a);
const fail = (msg) => {
  console.error("✗", msg);
  process.exitCode = 1;
};
async function shot(page, name) {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  if (sw > w + 1) fail(`${name}: horizontal overflow (${sw}px > ${w}px)`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
async function expectText(page, text, timeout = 8000) {
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout });
  } catch {
    fail(`missing text: ${text} on ${page.url()}`);
  }
}
const sq = (page, s) => page.locator(`.board button[aria-label^="${s},"]`);
const fen = (page) => page.locator(".board").first().getAttribute("data-fen");
const ready = (page) => page.getByRole("button", { name: L.next, exact: true }).isVisible();
async function move(page, from, to) {
  await sq(page, from).click();
  await sq(page, to).click();
}

function starPath(startFen, stars) {
  const q = [{ fen: startFen, left: stars, path: [] }];
  const seen = new Set();
  while (q.length) {
    const cur = q.shift();
    if (!cur.left.length) return cur.path;
    const c = new Chess(cur.fen, { skipValidation: true });
    for (const m of c.moves({ verbose: true })) {
      const left = cur.left.filter((s) => s !== m.to);
      const key = m.to + left.join();
      if (seen.has(key)) continue;
      seen.add(key);
      c.move(m);
      const parts = c.fen().split(" ");
      parts[1] = "w";
      parts[3] = "-";
      c.undo();
      q.push({ fen: parts.join(" "), left, path: [...cur.path, [m.from, m.to]] });
    }
  }
  return [];
}

async function solveStep(page) {
  if (await ready(page)) return;
  const k = await page.locator(".lesson-stage").getAttribute("data-kind");
  if (k === "choice") {
    for (const r of await page.locator(".choices [role=radio]").all()) {
      await r.click();
      if (await ready(page)) return;
    }
  } else if (k === "tap") {
    await page.getByRole("button", { name: L.hint }).click();
    await page.locator(".board .is-hint").first().click();
  } else if (k === "stars") {
    const stars = ((await page.locator(".board").getAttribute("data-stars")) ?? "").split(" ").filter(Boolean);
    for (const [from, to] of starPath(await fen(page), stars)) await move(page, from, to);
  } else if (k === "move") {
    const c = new Chess(await fen(page), { skipValidation: true });
    for (const m of c.moves({ verbose: true })) {
      await move(page, m.from, m.to);
      if (await ready(page)) return;
    }
  } else if (k === "line") {
    for (let i = 0; i < 12 && !(await ready(page)); i++) {
      const hint = page.getByRole("button", { name: L.hint });
      if (await hint.isVisible()) await hint.click();
      const squares = page.locator(".board .is-hint");
      if ((await squares.count()) < 2) {
        await page.waitForTimeout(700);
        continue;
      }
      // The highlighted pair is from + to; the "from" square holds a piece of the side to move.
      const a = (await squares.nth(0).getAttribute("aria-label")).slice(0, 2);
      const b = (await squares.nth(1).getAttribute("aria-label")).slice(0, 2);
      const c = new Chess(await fen(page), { skipValidation: true });
      const [from, to] = c.get(a)?.color === c.turn() ? [a, b] : [b, a];
      await move(page, from, to);
      await page.waitForTimeout(900);
    }
  }
  if (!(await ready(page))) fail(`could not solve ${k} step on ${page.url()}`);
}

async function playLesson(page, id, name) {
  await page.goto(`${BASE}/lesson/${id}`);
  await page.locator(".lesson-stage").waitFor();
  let n = 0;
  while (await page.locator(".lesson-stage").isVisible()) {
    await solveStep(page);
    if (n === 1) await shot(page, `${name}-step`);
    await page.getByRole("button", { name: L.next, exact: true }).click();
    if (++n > 30) return fail(`${id}: too many steps`);
  }
  await page.waitForTimeout(700);
}


const KEY = "chessschool.v2.state";
const L = { next: "Continue", hint: "Show me" };
const patchState = (page, fn) => page.evaluate(([k, f]) => {
  const s = JSON.parse(localStorage.getItem(k));
  new Function("s", f)(s);
  localStorage.setItem(k, JSON.stringify(s));
}, [KEY, fn]);

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await ctx.newPage();
page.on("pageerror", (e) => fail(`page error: ${e.message}`));
await page.goto(BASE + "/welcome");
await page.getByRole("button", { name: "Skip" }).click().catch(() => {});
await page.getByRole("button", { name: "Start as a guest" }).click().catch(() => {});
await page.waitForURL("**/today");
await patchState(page, "s.notificationOffered = true");

log("league as a guest");
await page.goto(BASE + "/league");
await expectText(page, "Join a weekly league");
await shot(page, "01-league-guest");

log("mate of the day");
const today = await page.evaluate(() => fetch("/v1/mate/" + new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)).then((r) => r.json()));
await page.goto(`${BASE}/mate/${today.day}`);
await page.locator(".board").first().waitFor();
await shot(page, "02-mate-start");
const fenNow = async () => page.locator(".board").first().getAttribute("data-fen");
// One wrong first move, then the right line.
await page.waitForFunction((f) => document.querySelector(".board")?.getAttribute("data-fen") !== f, today.puzzle.fen);
const c = new Chess(await fenNow());
const bad = c.moves({ verbose: true }).find((m) => `${m.from}${m.to}` !== today.puzzle.moves[1] && !m.san.includes("#"));
await move(page, bad.from, bad.to);
await expectText(page, "Try again");
await shot(page, "03-mate-missed");
await page.getByRole("button", { name: "Try again" }).click();
for (const i of [1, 3]) {
  await page.waitForFunction(([m]) => {
    const b = document.querySelector(".board");
    return b && b.querySelector(`button[aria-label^="${m.slice(0, 2)},"]`) && !b.closest("[aria-busy]");
  }, [today.puzzle.moves[i]]);
  await page.waitForTimeout(1200);
  await move(page, today.puzzle.moves[i].slice(0, 2), today.puzzle.moves[i].slice(2, 4));
}
await expectText(page, "Solved in 2 tries");
await expectText(page, "solved it today");
await shot(page, "04-mate-solved");
await page.evaluate(() => { navigator.share = undefined; });
await page.getByRole("button", { name: "Share" }).click();
const shared = await page.evaluate(() => navigator.clipboard.readText());
log("share text:\n" + shared);
if (!shared.endsWith(`https://chess-school.in/mate/${today.day}`)) fail("share link missing");
if (!shared.includes("🟥⬜\n🟩🟩\n⬜⬜")) fail("share grid wrong");
const body = shared.split("\n").slice(1, -1).join("\n");
if (/[a-h][1-8]|[KQRBN]x?[a-h]|O-O|#|\+/.test(body)) fail("share text spoils the moves");

log("sign up, place, play a lesson");
await page.goto(`${BASE}/signup`);
await page.getByLabel("Your name").fill("Asha Learner");
await page.getByLabel("Email").fill(`habit-${Date.now()}@example.com`);
await page.getByLabel("Password", { exact: true }).fill("pawnpawn1");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL("**/today");
await page.goto(`${BASE}/league`);
await expectText(page, "Finish a lesson this week to join a league.");
await page.goto(`${BASE}/today`);
await page.getByRole("button", { name: "I already play games" }).click();
await playLesson(page, "castling", "05-castling");
await expectText(page, "Accuracy");
await expectText(page, "Time");
await shot(page, "06-summary-en");
if (await page.getByText("in a row").count()) log("best run line shown");

log("league table after the sync");
await page.waitForTimeout(2500);
await page.goto(`${BASE}/league`);
await expectText(page, "Pawn League");
await expectText(page, "Asha (You)");
await expectText(page, "Promotion zone");
await shot(page, "07-league");

log("Hindi summary");
await patchState(page, "s.prefs.lang = 'hi'");
Object.assign(L, { next: "आगे", hint: "दिखाएँ" });
await playLesson(page, "special", "08-special");
await expectText(page, "सटीकता");
await expectText(page, "समय");
await shot(page, "09-summary-hi");
await page.goto(`${BASE}/league`);
await expectText(page, "प्यादा लीग");
await shot(page, "10-league-hi");
await page.goto(`${BASE}/today`);
await expectText(page, "आज की शह-मात");
await shot(page, "11-today-hi");

await browser.close();
console.log(process.exitCode ? "FAILED" : "OK");
