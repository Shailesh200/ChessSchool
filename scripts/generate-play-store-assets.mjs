#!/usr/bin/env node
/**
 * Generate required Google Play Store graphics (non-optional):
 * - App icon 512×512
 * - Feature graphic 1024×500
 * - Phone screenshots 1080×1920 (4–8)
 *
 * Usage: node scripts/generate-play-store-assets.mjs
 * Env:   BASE=https://chess-school.in (default)
 */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "apps/mobile/store-assets/play-store");
const ICON_SRC = join(ROOT, "apps/mobile/assets/icon.png");
const BASE = process.env.BASE || "http://localhost:3210";

const BRAND = "#5b5bd6";
const BG = "#fbfaff";
const INK = "#1a1a2e";

await mkdir(OUT, { recursive: true });
await mkdir(join(OUT, "screenshots"), { recursive: true });

// ── 512×512 app icon ───────────────────────────────────────────────────────
await sharp(ICON_SRC)
  .resize(512, 512, { fit: "cover" })
  .png()
  .toFile(join(OUT, "icon-512.png"));
console.log("✓ icon-512.png");

// ── 1024×500 feature graphic ───────────────────────────────────────────────
const iconBuf = await sharp(ICON_SRC).resize(200, 200, { fit: "cover" }).png().toBuffer();
const iconB64 = iconBuf.toString("base64");

const featureSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="#eef0ff"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="none"/>
      <path d="M0 20h40M20 0v40" stroke="${BRAND}" stroke-opacity="0.08" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <rect width="1024" height="500" fill="url(#grid)"/>
  <circle cx="900" cy="80" r="120" fill="${BRAND}" fill-opacity="0.12"/>
  <circle cx="120" cy="420" r="90" fill="${BRAND}" fill-opacity="0.1"/>
  <image href="data:image/png;base64,${iconB64}" x="72" y="150" width="200" height="200" rx="40"/>
  <text x="310" y="210" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="64" font-weight="800" fill="${INK}">ChessSchool</text>
  <text x="310" y="270" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="28" font-weight="500" fill="${BRAND}">Learn chess like a school — classes, lessons &amp; play</text>
  <text x="310" y="330" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="22" fill="#5c5c7a">Structured curriculum · Offline PWA · Free to learn</text>
</svg>`;

await sharp(Buffer.from(featureSvg)).png().toFile(join(OUT, "feature-graphic-1024x500.png"));
console.log("✓ feature-graphic-1024x500.png");

// ── Phone screenshots 1080×1920 ──────────────────────────────────────────────
const shots = [
  { path: "/academy", name: "01-academy", wait: 1200, ready: "Start learning" },
  { path: "/class/class-pieces", name: "02-class-journey", wait: 1500, ready: "Piece Movement" },
  { path: "/lesson/pawn-power", name: "03-lesson", wait: 1800, ready: "Push your e-pawn" },
  { path: "/play", name: "04-play", wait: 1400, ready: "New match" },
  { path: "/review", name: "05-review", wait: 1000, ready: "Review" },
  { path: "/profile", name: "06-profile", wait: 1000, ready: "Playing as guest" },
];

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
});
const page = await ctx.newPage();
await page.addInitScript(() => {
  const hide = () => {
    const s = document.createElement("style");
    s.textContent = `
      nextjs-portal, [data-nextjs-toast], [data-next-badge-root],
      #devtools-indicator, .nextjs-toast-errors-parent { display: none !important; }
    `;
    document.head.appendChild(s);
  };
  hide();
  new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
});

for (const s of shots) {
  await page.goto(BASE + s.path, { waitUntil: "domcontentloaded", timeout: 60000 });
  const is404 = await page.locator("text=This page could not be found").count();
  if (is404 > 0) throw new Error(`404 at ${BASE}${s.path} — start local dev or deploy latest web`);
  try {
    await page.getByText(s.ready, { exact: false }).first().waitFor({ timeout: 20000 });
  } catch {
    await page.waitForTimeout(s.wait);
  }
  await page.waitForTimeout(400);
  const out = join(OUT, "screenshots", `${s.name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  const meta = await sharp(out).metadata();
  if (meta.width !== 1080 || meta.height !== 1920) {
    const tmp = out + ".tmp.png";
    await sharp(out)
      .resize(1080, 1920, { fit: "cover", position: "top" })
      .png()
      .toFile(tmp);
    await sharp(tmp).png().toFile(out);
  }
  console.log("✓ screenshots/" + s.name + ".png");
}

await browser.close();
console.log("\nPlay Store assets saved to apps/mobile/store-assets/play-store/");
