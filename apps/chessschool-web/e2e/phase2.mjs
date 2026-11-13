// Phase 2 walkthrough: plays the whole beginner path, Practice and a game vs Cody, then signs up
// and checks that guest chess progress survives. Saves screenshots.
// Usage: node e2e/phase2.mjs [outDir]   (web on :3100, API on :3300)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../packages/chessschool-chess/package.json", import.meta.url));
const { Chess } = require("chess.js");

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const apiBase = process.env.CHESSSCHOOL_API_URL ?? "";
if (apiBase.toLowerCase().includes("chess-school.in")) {
  console.error("refusing to run: API base URL must be a local server");
  process.exit(1);
}
const OUT = process.argv[2] ?? "/tmp/cs-phase2";
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
async function expectText(page, text, timeout = 6000) {
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout });
  } catch {
    fail(`missing text: ${text} on ${page.url()}`);
  }
}
const sq = (page, s) => page.locator(`.board button[aria-label^="${s},"]`);
const fen = (page) => page.locator(".board").getAttribute("data-fen");
const kind = (page) => page.locator(".lesson-stage").getAttribute("data-kind");
const ready = (page) => page.getByRole("button", { name: "Continue", exact: true }).isVisible();

async function move(page, from, to) {
  await sq(page, from).click();
  await sq(page, to).click();
}

/** Finds a path for the lone white piece through every star (breadth-first). */
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

/** Solves whatever step is on screen, the way a learner would (a few misses allowed). */
async function solveStep(page) {
  if (await ready(page)) return;
  const k = await kind(page);
  if (k === "choice") {
    for (const r of await page.locator(".choices [role=radio]").all()) {
      await r.click();
      if (await ready(page)) return;
    }
  } else if (k === "tap") {
    await page.getByRole("button", { name: "Show me" }).click();
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
      await page.getByText("Your move").first().waitFor({ timeout: 1 }).catch(() => {});
      const hint = page.getByRole("button", { name: "Show me" });
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
  } else if (k === "game") {
    for (let i = 0; i < 80; i++) {
      if (await ready(page)) return;
      const end = page.getByRole("button", { name: "End game here" });
      if (await end.isVisible()) return end.click();
      await page.getByText("Your move").first().waitFor({ timeout: 8000 });
      const c = new Chess(await fen(page));
      const ms = c.moves({ verbose: true });
      const m = ms.find((x) => x.captured) ?? ms[(i * 7) % ms.length];
      await move(page, m.from, m.to);
      await page.waitForTimeout(150);
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
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    n++;
    if (n > 30) return fail(`${id}: too many steps`);
  }
  await page.waitForTimeout(900);
  await shot(page, `${name}-done`);
}

async function guestStart(page) {
  await page.goto(BASE + "/welcome");
  await page.getByRole("button", { name: "Skip" }).click().catch(() => {});
  const guest = page.getByRole("button", { name: "Start as a guest" });
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.waitForURL("**/today");
}

async function mobile(scheme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
  const page = await ctx.newPage();
  const p = `m-${scheme}`;
  await guestStart(page);

  // A locked lesson explains itself.
  await page.goto(`${BASE}/lesson/check`);
  await expectText(page, "This lesson isn't open yet.");
  await shot(page, `${p}-01-locked`);

  // Orientation still works, then the first chess lesson opens on Today.
  await page.goto(`${BASE}/orientation`);
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "I've got it" }).click();
  await expectText(page, "Welcome to the school!");
  await page.goto(`${BASE}/today`);
  await page.getByRole("button", { name: "Not now" }).click({ timeout: 4000 }).catch(() => {});
  await expectText(page, "The board");
  await page.waitForTimeout(800);
  await shot(page, `${p}-02-today-next`);

  // A miss shakes gently and shows a hint; the right square continues.
  await page.getByRole("link", { name: "Start lesson" }).click();
  await page.waitForURL("**/lesson/board");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await sq(page, "a1").click();
  await expectText(page, "Find the e-file");
  await shot(page, `${p}-03-lesson-miss`);
  await sq(page, "e4").click();
  if (!(await ready(page))) fail("e4 did not complete the tap step");
  await shot(page, `${p}-04-lesson-right`);

  for (const [id, name] of [
    ["board", "05-board"],
    ["moves", "06-moves"],
    ["pawns", "07-pawns"],
    ["check", "08-check"],
    ["firstGame", "09-first-game"],
  ]) {
    log(scheme, "lesson", id);
    await playLesson(page, id, `${p}-${name}`);
  }
  await expectText(page, "Next up: Castling");

  await page.goto(`${BASE}/today`);
  await expectText(page, "Castling");
  await expectText(page, "125 XP");
  await expectText(page, "1 day");
  await shot(page, `${p}-10-today-all-done`);

  // Practice: five drills from finished lessons.
  await page.goto(`${BASE}/practice`);
  await shot(page, `${p}-11-practice`);
  await page.getByRole("link", { name: "Start practice" }).click();
  await page.waitForURL("**/practice/session");
  for (let i = 0; i < 5; i++) {
    await solveStep(page);
    if (i === 0) await shot(page, `${p}-12-drill`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await expectText(page, "Practice done!");
  await shot(page, `${p}-13-practice-done`);

  // Play vs Cody from the Gym: move, Cody replies, take back, leave and resume, resign.
  await page.goto(`${BASE}/rooms`);
  await page.waitForURL("**/gym");
  await shot(page, `${p}-14-gym`);
  await page.getByRole("link", { name: /^Cody\./ }).click();
  await page.waitForURL("**/play?bot=cody");
  await shot(page, `${p}-15-play-setup`);
  await page.getByRole("button", { name: "Start game" }).click();
  await move(page, "e2", "e4");
  await expectText(page, "Your move", 8000);
  const afterReply = await fen(page);
  if (afterReply.startsWith("rnbqkbnr/pppppppp")) fail("Cody did not reply");
  await shot(page, `${p}-16-play-game`);
  await page.getByRole("button", { name: "Take back" }).click();
  if ((await fen(page)) !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") fail("take back failed");
  await move(page, "d2", "d4");
  await expectText(page, "Your move", 8000);
  await page.goto(`${BASE}/today`);
  await page.goto(`${BASE}/play`);
  await expectText(page, "Continue your game");
  await page.getByRole("button", { name: "Continue your game" }).click();
  await page.getByRole("button", { name: "Resign" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Resign" }).click();
  await expectText(page, "Game over.");
  await shot(page, `${p}-17-play-result`);
  await page.goto(`${BASE}/gym`);
  await expectText(page, "0/1 won");

  // Guest -> account keeps every lesson, the game and practice.
  const email = `p2-${scheme}-${Date.now()}@example.com`;
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("pawnpawn1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/today");
  await expectText(page, "Your progress is saved.");
  await expectText(page, "125 XP");
  await page.waitForTimeout(1500); // let the debounced progress push land

  // A wiped device gets everything back from the account.
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("pawnpawn1");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/today");
  await expectText(page, "125 XP");
  await expectText(page, "Castling");
  await page.goto(`${BASE}/you`);
  await expectText(page, "Games played");
  await shot(page, `${p}-18-you-after-login`);
  await ctx.close();
}

async function desktop() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await guestStart(page);
  await page.goto(`${BASE}/orientation`);
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "I've got it" }).click();
  await page.goto(`${BASE}/lesson/board`);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await shot(page, "d-01-lesson");
  // Keyboard: focus the board and press Enter on a square.
  await sq(page, "e2").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  if (!(await ready(page))) fail("keyboard tap on e4 did not work");
  await playLesson(page, "board", "d-02-board");
  await page.goto(`${BASE}/today`);
  await page.waitForTimeout(800);
  await shot(page, "d-03-today");
  await page.goto(`${BASE}/play`);
  await page.getByRole("radio", { name: /^Professor Bishop/ }).click();
  await page.getByRole("radio", { name: "Black" }).click();
  await page.getByRole("button", { name: "Start game" }).click();
  await expectText(page, "Your move", 8000);
  await shot(page, "d-04-play-black");
  await ctx.close();
}

async function reducedMotion() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await guestStart(page);
  await page.goto(`${BASE}/orientation`);
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "I've got it" }).click();
  await playLesson(page, "board", "rm-01-board");
  const anim = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getComputedTiming().duration ?? 0) > 50).length);
  if (anim) fail(`reduced motion: ${anim} animations still running`);
  await ctx.close();
}

async function cameBack() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await guestStart(page);
  // Pretend the last lesson was yesterday.
  await page.evaluate(() => {
    const k = "chessschool.v2.state";
    const s = JSON.parse(localStorage.getItem(k));
    const d = new Date(Date.now() - 86_400_000);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    s.progress = { ...s.progress, completed: { meet: day }, xp: 10, streak: { count: 3, lastDay: day } };
    s.lastOpenDay = day;
    s.notificationOffered = true;
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.goto(`${BASE}/today`);
  await expectText(page, "You came back!");
  await expectText(page, "3-day streak is waiting");
  await page.waitForTimeout(900);
  await shot(page, "cb-01-came-back");
  await playLesson(page, "board", "cb-02-board");
  await expectText(page, "Day 4 of your streak!");
  await page.goto(`${BASE}/today`);
  await expectText(page, "4 days");
  if (await page.getByText("You came back!").isVisible()) fail("came-back banner still shown after a lesson");
  await ctx.close();
}

await mobile("light");
await mobile("dark");
await desktop();
await reducedMotion();
await cameBack();
await browser.close();
console.log(process.exitCode ? "phase 2: FAILED" : "phase 2: all flows passed");
