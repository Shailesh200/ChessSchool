#!/usr/bin/env node
/** Capture 390px Expo-web BOA screens into docs/nov2/boa/implement/ (requires prior web export). */
import { spawn } from "node:child_process";
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
  { url: "/", out: "01-splash-390.png", orient: false },
  { url: "/boa/onboarding", out: "02a-onboarding-goal-390.png", orient: false },
  { url: "/boa/onboarding?step=1", out: "02b-onboarding-level-390.png", orient: false },
  { url: "/login?boaAuth=signin", out: "16-auth-signin-390.png", orient: true },
  { url: "/login?boaAuth=signup", out: "16-auth-signup-390.png", orient: true },
  { url: "/login?boaAuth=errors", out: "16-auth-errors-390.png", orient: true },
  { url: "/forgot-password", out: "19a-forgot-password-entry-390.png", orient: true },
  { url: "/forgot-password?phase=sent", out: "19a-forgot-password-sent-390.png", orient: true },
  { url: "/reset-password?token=t&email=student@example.com", out: "19b-reset-password-390.png", orient: true },
  { url: "/reset-password?token=t&phase=error", out: "19b-reset-password-error-390.png", orient: true },
  { url: "/reset-password?token=t&phase=strong", out: "19b-reset-password-strong-390.png", orient: true },
  { url: "/reset-password?token=t&phase=success", out: "19b-reset-password-success-390.png", orient: true },
  { url: "/(tabs)/play", out: "12-play-hub-390.png", orient: true, guest: true },
  { url: "/play/game?coach=otto&elo=1000&dark=0", out: "12-play-match-390.png", orient: true, guest: true },
  { url: "/play/game?coach=ash&elo=1800&dark=1", out: "12-play-match-ash-390.png", orient: true, guest: true },
  { url: "/play/game?coach=rex&elo=1600&dark=0", out: "12-play-match-rex-390.png", orient: true, guest: true },
  { url: "/play/game?coach=skye&elo=800&dark=0", out: "12-play-match-skye-390.png", orient: true, guest: true },
  { url: "/play/game?coach=otto&elo=1000&dark=1", out: "12-play-match-dark-390.png", orient: true, guest: true },
  { url: "/play/game?coach=kira&elo=1200&boaPreview=won", out: "12-play-won-390.png", orient: true, guest: true },
  { url: "/play/game?coach=kira&elo=1200&boaPreview=lost", out: "12-play-lost-390.png", orient: true, guest: true },
];

function spaServer() {
  const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json" };
  return http.createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    if (p === "/") p = "/index.html";
    else if (!path.extname(p)) {
      const tryFile = path.join(dist, p.slice(1) + ".html");
      p = fs.existsSync(tryFile) ? "/" + p.slice(1) + ".html" : "/index.html";
    }
    const file = path.join(dist, p.replace(/^\//, ""));
    if (!file.startsWith(dist) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end("missing");
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
    const base = {
      uiKit: "premium",
      themeMode: "light",
      appTheme: "default",
      haptics: true,
      sound: false,
      volume: 0,
      reducedMotion: true,
    };
    localStorage.setItem("chessschool.settings", JSON.stringify(base));
    if (guest) sessionStorage.setItem("chessschool.boaCaptureGuest", "1");
  }, { orient, guest });
}

async function main() {
  if (!fs.existsSync(dist)) {
    console.error("Missing", dist, "— run expo export with EXPO_PUBLIC_BOA_CAPTURE=1 first");
    process.exit(1);
  }
  fs.mkdirSync(implDir, { recursive: true });
  const server = spaServer();
  await new Promise((r) => server.listen(port, r));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  for (const shot of shots) {
    const page = await context.newPage();
    await seed(page, { orient: shot.orient !== false, guest: !!shot.guest });
    const url = `http://127.0.0.1:${port}${shot.url}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    if (shot.guest) {
      const guestBtn = page.getByText("Continue as guest", { exact: false });
      if (await guestBtn.isVisible().catch(() => false)) {
        await guestBtn.click();
        await page.waitForTimeout(800);
      }
    }
    await page.waitForTimeout(shot.guest ? 1200 : 600);
    const target = shot.guest
      ? page.locator('[data-testid="play-hub-premium"], [data-testid="boa-entry-splash"], body').first()
      : page.locator("body");
    await target.screenshot({ path: path.join(implDir, shot.out) });
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
