// Phase 3 track D walkthrough: share card from the certificate-free path (weekly card on Profile),
// a puzzle challenge opened by a guest on a phone, an async game between two browsers, the invite
// page, the app-link files and the growth dashboard guard.
// Usage: node e2e/v3-growth.mjs [outDir]   (web on :3541, API on :3540; both local)
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3541";
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) {
  console.error("refusing to run: BASE_URL must be a local server");
  process.exit(1);
}
const OUT = process.argv[2] ?? "/tmp/cs-v3-growth";
mkdirSync(OUT, { recursive: true });
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
const PNG = [0x89, 0x50, 0x4e, 0x47];

async function run() {
  log("sign up (first run: welcome, then Today)");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Capture what the page hands to the share sheet: the test browser has none.
  await ctx.addInitScript(() => {
    window.__shared = [];
    navigator.canShare = (d) => Boolean(d?.files?.length);
    navigator.share = async (d) => {
      const f = d.files?.[0];
      window.__shared.push({ text: d.text ?? null, url: d.url ?? null, file: f ? { name: f.name, type: f.type, head: [...new Uint8Array(await f.arrayBuffer()).slice(0, 4)], size: f.size } : null });
    };
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Your name").fill("Asha Rao");
  await page.getByLabel("Email").fill(`v3d-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("pawnpawn1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/welcome");
  await page.getByRole("button", { name: "Skip" }).click();
  await page.waitForURL("**/today");

  log("weekly card: from Profile to the share sheet with a PNG file");
  await page.goto(`${BASE}/you`);
  await page.getByRole("button", { name: "Share this week" }).click();
  await page.waitForFunction(() => window.__shared.length === 1, null, { timeout: 60_000 });
  const shared = (await page.evaluate(() => window.__shared))[0];
  check(shared.file?.type === "image/png" && JSON.stringify(shared.file.head) === JSON.stringify(PNG) && shared.file.size > 20_000, `share sheet got a PNG (${shared.file?.size} bytes)`);
  const link = /https:\/\/chess-school\.in\/s\/([\w-]+)/.exec(shared.text ?? "");
  check(Boolean(link), `share text carries the card link: ${shared.text}`);
  await page.goto(`${BASE}/s/${link[1]}`);
  const img = page.locator("img.landing-card");
  await img.waitFor();
  check(await img.evaluate((el) => el.complete && el.naturalWidth === 1080 && el.naturalHeight === 1920), "the /s page shows the 1080x1920 card");
  await page.screenshot({ path: `${OUT}/01-shared-card.png` });

  log("browsers without file sharing download the card instead");
  await page.evaluate(() => (navigator.canShare = () => false));
  await page.goto(`${BASE}/you`);
  await page.evaluate(() => (navigator.canShare = () => false));
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Share this week" }).click()]);
  check(download.suggestedFilename() === "chessschool-card.png", "downloaded chessschool-card.png");

  log("invite card and invite page");
  const invite = await page.evaluate(async () => (await fetch("/v1/invites/mine")).json());
  await page.goto(`${BASE}/you`);
  await page.getByRole("heading", { name: "Invite a friend" }).waitFor();
  const guest = await browser.newContext({ ...devices["Pixel 7"] });
  const phone = await guest.newPage();
  await phone.goto(`${BASE}/i/${invite.code}`);
  await phone.getByRole("heading", { name: "Asha invited you to ChessSchool" }).waitFor();
  check((await phone.evaluate(() => localStorage.getItem("chessschool.v2.invite"))) === invite.code, "the invite code is remembered on the friend's device");
  await phone.screenshot({ path: `${OUT}/02-invite.png` });

  log("challenge: an async game, the friend on a phone with no account");
  const made = await page.evaluate(async () => (await (await fetch("/v1/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "game" }) })).json()).challenge);
  await page.goto(`${BASE}/c/${made.code}`);
  await page.getByRole("heading", { name: "This is your challenge. Send the link to a friend." }).waitFor();
  check(/Mobile/.test(await phone.evaluate(() => navigator.userAgent)), "the friend uses a mobile user agent");
  await phone.goto(`${BASE}/c/${made.code}`);
  await phone.getByRole("heading", { name: "Asha challenged you to a game" }).waitFor();
  await phone.screenshot({ path: `${OUT}/03-challenge-phone.png` });
  await phone.getByRole("button", { name: "Accept the challenge" }).click();
  await phone.locator(".board").waitFor();
  await page.reload();
  await page.locator(".board").waitFor();
  await move(page, "f2", "f3");
  await phone.getByText("Your move").waitFor({ timeout: 15_000 });
  await move(phone, "e7", "e5");
  await page.getByText("Your move").waitFor({ timeout: 15_000 });
  await move(page, "g2", "g4");
  await phone.getByText("Your move").waitFor({ timeout: 15_000 });
  await move(phone, "d8", "h4");
  await phone.locator('main[data-status="over"]').waitFor({ timeout: 15_000 });
  await page.locator('main[data-status="over"]').waitFor({ timeout: 15_000 });
  check(true, "four moves alternated between the two browsers and the game ended in mate");
  const [sw, w] = await phone.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  check(sw <= w + 1, "no horizontal overflow on the phone");
  await phone.screenshot({ path: `${OUT}/04-challenge-over.png` });
  const third = await (await browser.newContext()).newPage();
  const res = await third.request.post(`${BASE}/v1/challenges/${made.code}/accept`, { data: {} });
  check(res.status() === 409, "a third person cannot take the seat");
  await phone.goto(`${BASE}/c/zzzzzzzz`);
  await phone.getByRole("heading", { name: "This challenge has ended. Challenges last 7 days." }).waitFor();

  log("app-link files and the admin guard");
  const aasa = await (await page.request.get(`${BASE}/.well-known/apple-app-site-association`)).json();
  check(aasa.applinks.details[0].appIDs[0] === "ARDSWV5GD2.com.chessschool.app" && aasa.applinks.details[0].components.map((c) => c["/"]).join() === "/c/*,/s/*,/mate/*,/i/*", "apple-app-site-association lists the team, bundle and four paths");
  const links = await (await page.request.get(`${BASE}/.well-known/assetlinks.json`)).json();
  check(Array.isArray(links) && (links.length === 0 || links[0].target.package_name === "com.chessschool.app"), `assetlinks.json serves ${links.length ? "the configured fingerprint" : "an empty list (no fingerprint set)"}`);
  await page.goto(`${BASE}/admin/growth`);
  await page.getByText("This account can't open the admin page.").waitFor();
  check(true, "the growth dashboard refuses a normal account");

  log("growth dashboard for the admin account (API started with ADMIN_EMAILS=admin-e2e@example.com)");
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  await admin.goto(`${BASE}/login`);
  const reg = await admin.request.post(`${BASE}/v1/auth/register`, { data: { name: "Admin", email: "admin-e2e@example.com", password: "pawnpawn1" } });
  if (!reg.ok()) await admin.request.post(`${BASE}/v1/auth/login`, { data: { email: "admin-e2e@example.com", password: "pawnpawn1" } });
  await admin.goto(`${BASE}/admin/growth`);
  const table = admin.getByTestId("growth-table");
  await table.waitFor();
  const text = await table.innerText();
  check(["Day-1 return", "Day-7 return", "Day-30 return", "Daily users / monthly users", "Crash-free sessions", "Shares per active learner", "Invite conversion"].every((m) => text.includes(m)), "the table lists all seven metrics");
  check((await table.locator("svg.sparkline path").count()) === 1, "with an inline SVG sparkline");
  await admin.screenshot({ path: `${OUT}/05-growth.png` });
}

try {
  await run();
} catch (err) {
  fail(String(err?.stack ?? err));
} finally {
  await browser.close();
}
console.log(process.exitCode ? "FAILED" : "PASSED");
