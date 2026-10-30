#!/usr/bin/env node
/** Capture 390px Expo-web BOA screens into docs/nov2/boa/implement/ (requires prior web export). */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps/mobile/dist-boa-capture");
const implDir = path.join(root, "docs/nov2/boa/implement");
const port = 4173;

const shots = [
  { url: "/", out: "01-splash-390.png", orient: false, guest: false, wait: "[data-testid='boa-entry-splash']" },
  { url: "/boa/onboarding", out: "02a-onboarding-goal-390.png", orient: false, wait: "text=What brings you here?" },
  { url: "/boa/onboarding?step=1", out: "02b-onboarding-level-390.png", orient: false, wait: "text=How much chess" },
  { url: "/boa/test-out", out: "02d-onboarding-testout-390.png", orient: false, wait: "[data-testid='boa-test-out']" },
  { url: "/login?boaAuth=signin", out: "16-auth-signin-390.png", orient: true, wait: "text=Sign in" },
  { url: "/login?boaAuth=signup", out: "16-auth-signup-390.png", orient: true, wait: "text=Create your account" },
  { url: "/login?boaAuth=errors", out: "16-auth-errors-390.png", orient: true, wait: "text=Check your details" },
  { url: "/forgot-password", out: "19a-forgot-password-entry-390.png", orient: true, wait: "[data-testid='forgot-password']" },
  { url: "/forgot-password?phase=sent", out: "19a-forgot-password-sent-390.png", orient: true, wait: "text=Check your email" },
  { url: "/reset-password?token=t&email=student@example.com", out: "19b-reset-password-390.png", orient: true, wait: "[data-testid='reset-password']" },
  { url: "/reset-password?token=t&phase=error", out: "19b-reset-password-error-390.png", orient: true, wait: "[data-testid='reset-password']" },
  { url: "/reset-password?token=t&phase=strong", out: "19b-reset-password-strong-390.png", orient: true, wait: "[data-testid='reset-password']" },
  { url: "/reset-password?token=t&phase=success", out: "19b-reset-password-success-390.png", orient: true, wait: "[data-testid='reset-password-success']" },
  { url: "/play", out: "12-play-hub-390.png", orient: true, guest: true, wait: "[data-testid='play-hub-premium']" },
  { url: "/play/game?coach=otto&elo=1000&dark=0", out: "12-play-match-390.png", orient: true, guest: true, wait: "text=Otto" },
  { url: "/play/game?coach=ash&elo=1800&dark=1", out: "12-play-match-ash-390.png", orient: true, guest: true, wait: "text=Ash" },
  { url: "/play/game?coach=rex&elo=1600&dark=0", out: "12-play-match-rex-390.png", orient: true, guest: true, wait: "text=Rex" },
  { url: "/play/game?coach=skye&elo=800&dark=0", out: "12-play-match-skye-390.png", orient: true, guest: true, wait: "text=Skye" },
  { url: "/play/game?coach=otto&elo=1000&dark=1", out: "12-play-match-dark-390.png", orient: true, guest: true, wait: "[data-testid='premium-match']" },
  { url: "/play/game?coach=kira&elo=1200&boaPreview=won", out: "12-play-won-390.png", orient: true, guest: true, wait: "text=You won" },
  { url: "/play/game?coach=kira&elo=1200&boaPreview=lost", out: "12-play-lost-390.png", orient: true, guest: true, wait: "text=Good fight" },
];

function spaServer() {
  const mime = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".json": "application/json",
    ".svg": "image/svg+xml",
  };
  return http.createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    else if (!path.extname(p)) {
      const candidates = [
        path.join(dist, p.slice(1) + ".html"),
        path.join(dist, p.slice(1), "index.html"),
      ];
      const hit = candidates.find((c) => fs.existsSync(c));
      p = hit ? hit.slice(dist.length) : "/index.html";
    }
    const file = path.join(dist, p.replace(/^\//, ""));
    if (!file.startsWith(dist) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end("missing " + p);
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { "Content-Type": mime[ext] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
}

async function seed(page, { orient, guest }) {
  await page.addInitScript(({ orient, guest }) => {
    if (orient) localStorage.setItem("chessschool.orientationSeen", "1");
    else localStorage.removeItem("chessschool.orientationSeen");
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({
        uiKit: "premium",
        themeMode: "light",
        appTheme: "default",
        haptics: true,
        sound: false,
        volume: 0,
        reducedMotion: true,
      }),
    );
    if (guest) localStorage.setItem("chessschool.boaCaptureGuest", "1");
    else localStorage.removeItem("chessschool.boaCaptureGuest");
  }, { orient, guest });
}

async function ensureGuest(page) {
  await page.goto(`http://127.0.0.1:${port}/play`, { waitUntil: "networkidle", timeout: 120_000 });
  const hub = page.locator("[data-testid='play-hub-premium']");
  if (await hub.isVisible().catch(() => false)) return;
  const guestBtn = page.getByRole("button", { name: /Continue as guest/i });
  if (await guestBtn.isVisible().catch(() => false)) {
    await guestBtn.click();
    await page.waitForTimeout(1000);
  }
}

async function main() {
  if (!fs.existsSync(dist)) {
    console.error("Missing", dist, "— run: cd apps/mobile && EXPO_PUBLIC_BOA_CAPTURE=1 npx expo export --platform web --output-dir dist-boa-capture");
    process.exit(1);
  }
  fs.mkdirSync(implDir, { recursive: true });
  const server = spaServer();
  await new Promise((r) => server.listen(port, r));

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });

  let guestPrimed = false;

  for (const shot of shots) {
    const page = await context.newPage();
    await seed(page, { orient: shot.orient !== false, guest: !!shot.guest });
    if (shot.guest && !guestPrimed) {
      await ensureGuest(page);
      guestPrimed = true;
    }
    const url = `http://127.0.0.1:${port}${shot.url}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    if (shot.wait) await page.locator(shot.wait).first().waitFor({ timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(implDir, shot.out), fullPage: false });
    console.log("captured", shot.out);
    await page.close();
  }

  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
