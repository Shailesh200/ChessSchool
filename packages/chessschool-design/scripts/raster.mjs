#!/usr/bin/env node
// Store icons (copied from the published app identity) + generated PWA icons and OG image.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(PKG, "..", "..");
const SRC = join(ROOT, "apps/mobile/assets");
const OUT = join(PKG, "assets/raster");
mkdirSync(OUT, { recursive: true });

for (const f of ["icon.png", "adaptive-icon.png", "splash-icon.png", "favicon.png"]) copyFileSync(join(SRC, f), join(OUT, f));

const icon = join(OUT, "icon.png");
await sharp(icon).resize(192, 192).toFile(join(OUT, "pwa-192.png"));
await sharp(icon).resize(512, 512).toFile(join(OUT, "pwa-512.png"));
await sharp(icon).resize(180, 180).flatten({ background: "#5B5BD6" }).toFile(join(OUT, "apple-touch-icon.png"));
await sharp(icon).resize(48, 48).toFile(join(OUT, "favicon-48.png"));

// Maskable: full-bleed brand square with the mark inside the 80% safe zone.
const mark = await sharp(icon).resize(400, 400).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#5B5BD6" } })
  .composite([{ input: mark, gravity: "center" }])
  .png()
  .toFile(join(OUT, "pwa-maskable-512.png"));

// Splash for the native app: Cody on the app background is drawn at runtime; this is the OS splash.
const cody = readFileSync(join(PKG, "assets/svg/cody.svg"));
const codyPng = await sharp(cody, { density: 144 }).resize(520, 520).png().toBuffer();
const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EEF0FF"/><stop offset="1" stop-color="#DCDDFF"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="900" cy="330" r="250" fill="#FFFFFF" opacity="0.55"/>
  <text x="80" y="270" font-family="Fredoka, 'Arial Rounded MT Bold', Arial, sans-serif" font-size="92" font-weight="700" fill="#1C1B2E">ChessSchool</text>
  <text x="84" y="350" font-family="Fredoka, 'Arial Rounded MT Bold', Arial, sans-serif" font-size="38" fill="#5E5C78">A few calm minutes a day</text>
  <text x="84" y="400" font-family="Fredoka, 'Arial Rounded MT Bold', Arial, sans-serif" font-size="38" fill="#5E5C78">to get better at chess.</text>
  <rect x="84" y="450" width="230" height="64" rx="32" fill="#5B5BD6"/>
  <text x="199" y="492" text-anchor="middle" font-family="Fredoka, 'Arial Rounded MT Bold', Arial, sans-serif" font-size="28" font-weight="700" fill="#FFFFFF">Start free</text>
</svg>`);
await sharp(og)
  .composite([{ input: codyPng, left: 640, top: 70 }])
  .png()
  .toFile(join(OUT, "og.png"));

console.log("raster: store icons, pwa icons, og image");
