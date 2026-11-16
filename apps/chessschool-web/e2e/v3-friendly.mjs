// Phase 3 track C walkthrough: first lesson in 30 seconds (guest and new account), welcome,
// celebrations (each kind once, reduced motion), the rating chart against the server history,
// and the key-moment card after a pass & play game and an imported game (signed in: the Gym needs an account on the web).
// Usage: node e2e/v3-friendly.mjs [outDir]   (web on :3531, API on :3530; both local)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3531";
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) {
  console.error("refusing to run: BASE_URL must be a local server");
  process.exit(1);
}
const OUT = process.argv[2] ?? "/tmp/cs-v3-friendly";
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
const move = async (page, from, to) => {
  await sq(page, from).click();
  await sq(page, to).click();
};
// Writes the patch, then blocks the app's own saves until the next page load so it cannot overwrite it.
const patchState = (page, patch) =>
  page.evaluate(
    ([key, p]) => {
      localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), ...p }));
      Storage.prototype.setItem = () => {};
    },
    [STATE, patch],
  );
const readState = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE);

async function guestFirstRun() {
  log("guest: a new visitor lands in the first lesson");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
  // No OS share sheet in the test browser: Share falls back to the clipboard.
  await ctx.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(BASE);
  await page.waitForURL("**/lesson/board?first=1");
  await page.locator(".board").first().waitFor();
  const ms = Date.now() - t0;
  check(ms < 30_000, `first lesson board in ${ms} ms (limit 30000)`);
  await page.screenshot({ path: `${OUT}/01-first-lesson.png` });

  log("guest: leaving the lesson leads to welcome (language, coach, account offer)");
  await page.getByRole("button", { name: "Close lesson" }).click();
  await page.waitForURL("**/welcome");
  await page.getByRole("heading", { name: "Choose your language" }).waitFor();
  await page.getByRole("radio", { name: "हिन्दी" }).click();
  await page.getByRole("heading", { name: "अपनी भाषा चुनें" }).waitFor();
  await page.screenshot({ path: `${OUT}/02-welcome-hindi.png` });
  await page.getByRole("radio", { name: "English" }).click();
  await page.getByRole("heading", { name: "Choose your language" }).waitFor();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("heading", { name: "Pick your coach" }).waitFor();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("heading", { name: "Great first lesson!" }).waitFor();
  await page.screenshot({ path: `${OUT}/03-account-offer.png` });
  await page.getByRole("button", { name: "Maybe later" }).click();
  await page.waitForURL("**/today");
  await page.goto(BASE);
  await page.waitForURL("**/today");
  check(true, "a returning guest opens Today, not welcome");

  log("celebrations: each kind shows once");
  const kinds = [
    [{ id: "main:unit:unit1", kind: "unit", unit: "unit1" }, "complete!"],
    [{ id: "main:rank:knight", kind: "rank", rank: "knight" }, "You're a Knight now!"],
    [{ id: "main:rating:900", kind: "rating", rating: 900, milestone: true }, "Rating 900!"],
    [{ id: "main:league:knight:w1", kind: "league", league: "knight" }, "Up to the Knight league!"],
    [{ id: "main:streak:7", kind: "streak", days: 7 }, "7-day streak!"],
  ];
  await patchState(page, { pendingCelebrations: kinds.map(([c]) => c), celebrated: [] });
  await page.reload();
  for (const [c, title] of kinds) {
    const dialog = page.locator("dialog.celebration[open]");
    await dialog.getByRole("heading", { name: title }).waitFor();
    check((await dialog.getAttribute("aria-labelledby")) === "celebration-title" && (await dialog.evaluate((d) => d.matches(":modal"))), `${c.kind}: modal dialog named by its title`);
    check(await dialog.getByRole("button", { name: "Continue", exact: true }).evaluate((b) => b === document.activeElement), `${c.kind}: focus starts on Continue`);
    if (c.kind === "streak") {
      await page.screenshot({ path: `${OUT}/04-celebration.png` });
      await dialog.getByRole("button", { name: "Share" }).click();
      const text = await page.evaluate(() => navigator.clipboard.readText());
      check(text === "7-day streak! I'm learning chess on ChessSchool. https://chess-school.in", `share text: ${text}`);
    }
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await dialog.getByRole("heading", { name: title }).waitFor({ state: "detached" });
  }
  const after = await readState(page);
  check(after.pendingCelebrations.length === 0 && after.celebrated.length === 5, "all five are marked shown");
  await page.reload();
  await page.waitForTimeout(1800);
  check((await page.locator("dialog.celebration[open]").count()) === 0, "nothing shows a second time");

  await ctx.close();
}

async function reducedMotion() {
  log("celebration with reduced motion is static");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/today`);
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, STATE);
  await patchState(page, { seenWelcome: true, pendingCelebrations: [{ id: "main:streak:30", kind: "streak", days: 30 }] });
  await page.reload();
  const dialog = page.locator("dialog.celebration[open]");
  await dialog.waitFor();
  check((await dialog.evaluate((d) => getComputedStyle(d).animationName)) === "none", "dialog does not animate");
  await ctx.close();
}

async function accountFlow() {
  log("account: a brand-new account sees welcome (2 steps, no account offer), then Today");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Your name").fill("Chart");
  await page.getByLabel("Email").fill(`v3c-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("pawnpawn1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/welcome");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("heading", { name: "Pick your coach" }).waitFor();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/today");
  await page.goto(BASE);
  await page.waitForURL("**/today");
  check(true, "a signed-in account never reopens welcome or the first lesson");

  log("rating chart matches the server history");
  const history = await page.evaluate(async () => {
    const post = (body) => fetch("/v1/me/rating", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    for (const [i, result] of ["win", "win", "loss", "win", "win"].entries()) await post({ kind: "bot", event: `e2e-${i}`, bot: "cody", result, moves: 30 });
    return (await (await fetch("/v1/me/rating/history")).json()).points;
  });
  check(history.length === 5, `server history has ${history.length} points`);
  await page.goto(`${BASE}/you`);
  const svg = page.locator(".rating-chart svg");
  await svg.waitFor();
  check((await svg.getAttribute("data-points")) === String(history.length), "chart draws every server point");
  const cells = await page.locator(".rating-chart table tbody tr td:last-child").allTextContents();
  check(JSON.stringify(cells.map(Number)) === JSON.stringify(history.map((p) => p.rating)), `screen-reader table equals the server history: ${cells.join(", ")}`);
  check((await page.locator(".rating-chart-line").getAttribute("d")).split("L").length === history.length, "one line through every point");
  await page.screenshot({ path: `${OUT}/07-rating-chart.png`, fullPage: true });

  log("key moment: after a pass & play game");
  await page.goto(`${BASE}/play?mode=friend`);
  await page.getByRole("button", { name: "Start game" }).click();
  await move(page, "f2", "f3");
  await move(page, "e7", "e5");
  await move(page, "g2", "g4");
  await move(page, "d8", "h4");
  const card = page.locator("dialog[open] .key-moment");
  await card.waitFor({ timeout: 20_000 });
  const cardText = await card.innerText();
  check(/Played: 2\. g4/.test(cardText) && /Better: /.test(cardText), `friend game card: ${cardText.replace(/\n+/g, " | ")}`);
  check((await card.locator(".board").count()) === 1 && (await card.getByRole("button", { name: "Share" }).count()) === 1, "card has a board and a Share button");
  await page.screenshot({ path: `${OUT}/05-key-moment-friend.png` });

  log("key moment: after an imported game");
  const s = await readState(page);
  const imported = { id: "pgn:e2e", endedAt: Date.now(), setup: { opponent: { kind: "online" }, you: "w", time: "none", startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", takebacks: false, askPromotion: true }, history: ["f3", "e5", "g4", "Qh4#"], winner: "b", reason: "imported" };
  await patchState(page, { gameLog: [imported, ...s.gameLog] });
  await page.goto(`${BASE}/gym/review/${encodeURIComponent(imported.id)}`);
  const sheet = page.locator("dialog[open] .key-moment");
  await sheet.waitFor({ timeout: 20_000 }).catch(async (err) => {
    await page.screenshot({ path: `${OUT}/06-failed.png` });
    throw err;
  });
  check(/Played: 2\. g4/.test(await sheet.innerText()), "imported game card names the decisive move");
  await page.screenshot({ path: `${OUT}/06-key-moment-imported.png` });
  await sheet.getByRole("button", { name: "Show on board" }).click();
  await page.getByText("2. g4", { exact: false }).first().waitFor();
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  check(sw <= w + 1, "no horizontal overflow on the review page");
  await ctx.close();
}

try {
  await guestFirstRun();
  await reducedMotion();
  await accountFlow();
} catch (err) {
  fail(String(err?.stack ?? err));
} finally {
  await browser.close();
}
console.log(process.exitCode ? "FAILED" : "PASSED");
