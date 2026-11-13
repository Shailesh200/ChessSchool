// Phase 3 walkthrough: placement, Units 2–3, Puzzles (solve, daily, theme, sprint), Gym
// (bots, pass & play with clocks, Shuffle chess, review), Looks (themes, pieces, board, icon),
// achievements, feedback and account deletion. Saves screenshots.
// Usage: node e2e/phase3.mjs [outDir]   (web on :3100, API on :3300)
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../packages/chessschool-chess/package.json", import.meta.url));
const { Chess } = require("chess.js");
const fallback = readFileSync(new URL("../../../packages/chessschool-chess/src/puzzles.fallback.ts", import.meta.url), "utf8");
const PUZZLES = new Map();
for (const m of fallback.matchAll(/id: "([^"]+)"[\s\S]*?moves: \[([^\]]+)\]/g)) {
  PUZZLES.set(m[1], [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
}

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const apiBase = process.env.CHESSSCHOOL_API_URL ?? "";
if (apiBase.toLowerCase().includes("chess-school.in")) {
  console.error("refusing to run: API base URL must be a local server");
  process.exit(1);
}
const OUT = process.argv[2] ?? "/tmp/cs-phase3";
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
const ready = (page) => page.getByRole("button", { name: "Continue", exact: true }).isVisible();
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
    if (++n > 30) return fail(`${id}: too many steps`);
  }
  await page.waitForTimeout(700);
}

/** Plays the learner's moves of the puzzle on screen; `wrong` plays one bad move instead. */
async function solvePuzzle(page, wrong = false) {
  const marker = page.locator("[data-puzzle]");
  await marker.waitFor({ state: "attached" });
  const id = await marker.getAttribute("data-puzzle");
  const moves = PUZZLES.get(id);
  if (!moves) return fail(`unknown puzzle ${id}`);
  await page.waitForFunction(() => document.querySelector("[data-puzzle]")?.getAttribute("data-status") === "solving");
  if (wrong) {
    const c = new Chess(await fen(page));
    const bad = c.moves({ verbose: true }).find((m) => `${m.from}${m.to}` !== moves[1].slice(0, 4) && !m.san.endsWith("#"));
    await move(page, bad.from, bad.to);
    return;
  }
  for (let i = 1; i < moves.length; i += 2) {
    await page.waitForFunction(() => document.querySelector("[data-puzzle]")?.getAttribute("data-status") === "solving", null, { timeout: 5000 });
    await move(page, moves[i].slice(0, 2), moves[i].slice(2, 4));
  }
  await page.waitForFunction(() => document.querySelector("[data-puzzle]")?.getAttribute("data-status") === "solved", null, { timeout: 5000 }).catch(() => fail(`puzzle ${id} not solved`));
}

async function guest(page) {
  await page.goto(BASE + "/welcome");
  await page.getByRole("button", { name: "Skip" }).click().catch(() => {});
  await page.getByRole("button", { name: "Start as a guest" }).click().catch(() => {});
  await page.waitForURL("**/today");
  await page.evaluate(() => {
    const k = "chessschool.v2.state";
    const s = JSON.parse(localStorage.getItem(k));
    s.notificationOffered = true;
    localStorage.setItem(k, JSON.stringify(s));
  });
}

async function mobile() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(`page error: ${e.message}`));
  await guest(page);

  log("placement");
  await page.goto(`${BASE}/today`);
  await expectText(page, "Already know some chess?");
  await shot(page, "01-placement");
  await page.getByRole("button", { name: "I already play games" }).click();
  await expectText(page, "Castling");
  await expectText(page, "Skipped");
  await expectText(page, "0 XP");
  await shot(page, "02-placed");

  for (const id of ["castling", "special", "values", "forks", "pins", "ladder", "queenMate"]) {
    log("lesson", id);
    await playLesson(page, id, `03-${id}`);
  }
  await page.goto(`${BASE}/today`);
  await expectText(page, "You finished the path!");
  await expectText(page, "165 XP");
  await page.waitForTimeout(2000);
  await shot(page, "04-path-done");

  log("puzzles");
  await page.goto(`${BASE}/puzzles`);
  await expectText(page, "1000");
  await shot(page, "05-puzzles");
  await page.getByRole("link", { name: "Solve puzzles" }).click();
  await solvePuzzle(page);
  await expectText(page, "Solved!");
  await expectText(page, "(+");
  await shot(page, "06-puzzle-solved");
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await solvePuzzle(page, true);
  await expectText(page, "Not the move");
  await page.getByRole("button", { name: "Show answer" }).click();
  await shot(page, "07-puzzle-failed");
  await page.goto(`${BASE}/puzzles/solve?daily=1`);
  await solvePuzzle(page);
  await page.goto(`${BASE}/puzzles`);
  await expectText(page, "Solved today");
  await expectText(page, "1-day daily streak");
  await page.goto(`${BASE}/puzzles/solve?theme=fork`);
  await solvePuzzle(page);
  await page.goto(`${BASE}/puzzles/sprint`);
  await page.getByRole("button", { name: "Puzzle sprint" }).click();
  await solvePuzzle(page);
  await expectText(page, "1 solved");
  await page.waitForTimeout(800);
  await solvePuzzle(page, true);
  await expectText(page, "2 lives left");
  await shot(page, "08-sprint");

  log("gym");
  await page.goto(`${BASE}/gym`);
  await shot(page, "09-gym");
  for (const name of ["Pip", "Rooky", "Queen Ivy", "King Atlas"]) {
    await page.goto(`${BASE}/gym`);
    await page.getByRole("link", { name: new RegExp(`^${name}\\.`) }).click();
    await expectText(page, "Game setup");
  }
  // King Atlas: a real reply within a few seconds.
  await page.getByRole("button", { name: "Start game" }).click();
  const boardBox = JSON.stringify(await page.locator(".board").boundingBox());
  await move(page, "e2", "e4");
  await expectText(page, "Your move", 12000);
  await expectText(page, "King Atlas played");
  if (JSON.stringify(await page.locator(".board").boundingBox()) !== boardBox) fail("board moved when the move list grew");
  if (!(await page.locator(".move-strip .is-last").textContent())) fail("move strip has no last move");
  await shot(page, "10-atlas");
  const mute = page.getByRole("button", { name: "Mute move sounds" });
  await mute.click();
  await page.getByRole("button", { name: "Turn move sounds on" }).click();
  await page.locator(".move-strip").click();
  await expectText(page, "Move sounds");
  if ((await page.locator(".moves-table li").count()) !== 1) fail("moves sheet should list one move pair");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Resign" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Resign" }).click();
  await expectText(page, "Game over.");
  await page.locator("dialog[open] .accuracy-ring").waitFor();
  await page.waitForFunction(() => /\d+%/.test(document.querySelector("dialog[open] .ring-value")?.textContent ?? ""), null, { timeout: 20000 });
  await shot(page, "11-result");
  await page.locator("dialog[open]").getByRole("link", { name: "See analysis" }).click();
  await expectText(page, "Game analysis");
  await page.getByRole("button", { name: "Next move" }).click();
  await expectText(page, "1. e4");
  await shot(page, "11-analysis");

  // A known blunder (5. Qxe5+?? Nxe5): the analysis marks it and shows a better move.
  const blunderId = await page.evaluate(() => {
    const k = "chessschool.v2.state";
    const s = JSON.parse(localStorage.getItem(k));
    const g = { ...s.gameLog[0], id: "e2e-blunder", history: ["e4", "e5", "Qh5", "Nc6", "Qxe5+", "Nxe5"], winner: "b", reason: "resigned" };
    s.gameLog = [g, ...s.gameLog];
    localStorage.setItem(k, JSON.stringify(s));
    return g.id;
  });
  await page.goto(`${BASE}/gym/review/${blunderId}`);
  await page.waitForFunction(() => !document.body.textContent.includes("Cody is looking"), null, { timeout: 30000 });
  await page.locator(".moment", { hasText: "3 · Big mistake" }).click();
  await expectText(page, "3. Qxe5+ · Big mistake");
  if ((await page.locator(".board-arrows .arrow").count()) !== 2) fail("expected a played and a better arrow");
  await page.getByRole("button", { name: "Try the better move" }).click();
  await expectText(page, "Find the better move for White.");
  await page.getByRole("button", { name: "Show me" }).click();
  await expectText(page, "Here it is");
  if ((await page.locator(".board-arrows .arrow-better").count()) !== 1) fail("Show me should draw the better move");
  await shot(page, "11-try");

  log("pass & play with a clock");
  await page.goto(`${BASE}/play?mode=friend`);
  await page.getByRole("radio", { name: "3 + 2" }).click();
  await page.getByRole("button", { name: "Start game" }).click();
  await move(page, "e2", "e4");
  await expectText(page, "Black to move");
  const flipped = await page.locator(".board button").first().getAttribute("aria-label");
  if (!flipped.startsWith("h1")) fail(`board did not turn for Black (first square ${flipped})`);
  await move(page, "e7", "e5");
  await page.waitForTimeout(1200);
  const clocks = await page.locator(".clock").allTextContents();
  if (clocks.length !== 2 || !clocks.every((t) => /^\d:\d\d$/.test(t))) fail(`clocks look wrong: ${clocks}`);
  await shot(page, "12-pass-play");
  await page.getByRole("button", { name: "Take back" }).click();
  await expectText(page, "Black to move");
  await page.getByRole("button", { name: "Resign" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Resign" }).click();
  await expectText(page, "White wins!");
  await expectText(page, "Black resigned.");

  log("shuffle chess");
  await page.goto(`${BASE}/play?mode=shuffle`);
  await page.getByRole("button", { name: "Start game" }).click();
  await page.waitForTimeout(600);
  const shuffled = (await fen(page)).split(" ")[0];
  if (!/^[rnbqk]{8}\/p{8}/.test(shuffled)) fail(`not a shuffle start: ${shuffled}`);
  await shot(page, "13-shuffle");

  log("looks");
  await page.goto(`${BASE}/settings/looks`);
  await page.getByRole("radio", { name: "Midnight True black and gold" }).click();
  if ((await page.evaluate(() => document.documentElement.dataset.csTheme)) !== "midnight") fail("theme not applied");
  if ((await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) !== "rgb(0, 0, 0)") fail("midnight background not black");
  await page.getByRole("radio", { name: /^Outline/ }).click();
  await page.getByRole("switch", { name: /Show coordinates/ }).click();
  await page.getByRole("radio", { name: "Garden", exact: true }).click();
  await shot(page, "14-looks");
  const fav = await page.evaluate(() => document.querySelector('link[rel="icon"][data-cs]')?.getAttribute("href"));
  if (!fav?.includes("garden")) fail(`favicon not switched (${fav})`);
  await page.goto(`${BASE}/play?bot=cody&quick=1`);
  await page.waitForTimeout(800);
  if (await page.locator('.board img[src*="/assets/pieces/"]').count()) fail("removed piece set still drawn");
  if (!(await page.locator(".board svg.piece-svg").count())) fail("outline pieces not drawn");
  if (await page.locator(".board .coord").count()) fail("coordinates still shown");
  await shot(page, "15-midnight-heritage");
  // Reload keeps the theme without a flash.
  await page.reload();
  if ((await page.evaluate(() => document.documentElement.dataset.csTheme)) !== "midnight") fail("theme lost on reload");

  log("achievements");
  await page.goto(`${BASE}/you`);
  await expectText(page, "Achievements");
  await expectText(page, "Playing well");
  await shot(page, "16-profile");

  log("feedback");
  await page.goto(`${BASE}/settings`);
  await page.getByRole("button", { name: "Send feedback" }).click();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expectText(page, "Write a few words");
  await page.locator("textarea").fill("Loving the new Gym!");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expectText(page, "Thank you!");

  log("delete account");
  const email = `p3-${Date.now()}@example.com`;
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Your name").fill("Del");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("pawnpawn1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/today");
  await page.goto(`${BASE}/settings`);
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expectText(page, "Your account is deleted.");
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("pawnpawn1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expectText(page, "don't match");
  await ctx.close();
}

async function desktop() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await guest(page);
  await page.goto(`${BASE}/today`);
  await page.getByRole("button", { name: "I know how the pieces move" }).click();
  await page.goto(`${BASE}/lesson/check`);
  await page.locator(".lesson-stage").waitFor();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForTimeout(600);
  await shot(page, "d-01-lesson");
  const box = await page.locator(".board").boundingBox();
  if (box.width < 500) fail(`desktop board too small (${box.width}px)`);
  await page.goto(`${BASE}/gym`);
  await shot(page, "d-02-gym");
  await page.goto(`${BASE}/puzzles`);
  await shot(page, "d-03-puzzles");
  await ctx.close();
}

await mobile();
await desktop();
await browser.close();
console.log(process.exitCode ? "phase 3: FAILED" : "phase 3: all flows passed");
