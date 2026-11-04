#!/usr/bin/env node
// Generates the switchable app icons from Cody's vector rig (assets/svg/cody.svg).
//   node scripts/app-icons.mjs   (from packages/chessschool-design)
// Outputs assets/raster/app-icons/<id>.png (1024, opaque: iOS + web),
// <id>-fg.png (Android adaptive foreground) and <id>-preview.png (192, for pickers).
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(PKG, "assets/raster/app-icons");
mkdirSync(OUT, { recursive: true });
const cody = readFileSync(join(PKG, "assets/svg/cody.svg"), "utf8");
const codyInner = cody.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

/** Background as SVG markup on a 1024 canvas, plus the Android background colour. */
export const ICONS = {
  classroom: { bg: grad("#F4F3FF", "#C9C6F6"), color: "#E4E2FB" },
  night: { bg: grad("#1D1F3A", "#0B0C1E") + glow("#6363E0"), color: "#14152B" },
  garden: { bg: grad("#9CC78A", "#5E9A55"), color: "#7FA36B" },
  sunset: { bg: grad("#FFB08A", "#F06A6A"), color: "#F08A6A" },
  ocean: { bg: grad("#2EB3C4", "#0E6B7C"), color: "#117A8C" },
  midnight: { bg: `<rect width="1024" height="1024" fill="#000"/>` + ring("#E3B341"), color: "#000000" },
  library: { bg: grad("#A56A3A", "#5C3A1A") + grain(), color: "#7A4A23" },
  pixel: { bg: grad("#FFF4D6", "#F6C343") + pixels(), color: "#F6C343" },
};

function grad(a, b) {
  return `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`;
}
function glow(c) {
  return `<defs><radialGradient id="r"><stop offset="0" stop-color="${c}" stop-opacity="0.55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><circle cx="512" cy="560" r="420" fill="url(#r)"/>`;
}
function ring(c) {
  return `<circle cx="512" cy="540" r="400" fill="none" stroke="${c}" stroke-width="18" opacity="0.9"/>`;
}
function grain() {
  let s = "";
  for (let i = 0; i < 14; i++) s += `<path d="M0 ${70 * i + 20} C 300 ${70 * i - 10}, 700 ${70 * i + 50}, 1024 ${70 * i + 15}" stroke="#3E2610" stroke-width="5" fill="none" opacity="0.18"/>`;
  return s;
}
function pixels() {
  let s = "";
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2 === 0) s += `<rect x="${x * 64}" y="${y * 64}" width="64" height="64" fill="#8A6100" opacity="0.08"/>`;
  return s;
}

/** Cody placed in the icon's safe area. Pixel icon gets crisp, blocky Cody. */
function codyLayer(id, scale) {
  const size = 1024 * scale;
  const off = (1024 - size) / 2;
  return `<svg x="${off}" y="${off + 24 * scale}" width="${size}" height="${size}" viewBox="0 0 512 512" ${id === "pixel" ? 'shape-rendering="crispEdges"' : ""}>${codyInner}</svg>`;
}

for (const [id, { bg }] of Object.entries(ICONS)) {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${bg}${codyLayer(id, 0.86)}</svg>`;
  let img = sharp(Buffer.from(full)).flatten({ background: "#000" });
  if (id === "pixel") img = sharp(await img.resize(96, 96, { kernel: "nearest" }).png().toBuffer()).resize(1024, 1024, { kernel: "nearest" });
  const buf = await img.png().toBuffer();
  await sharp(buf).toFile(join(OUT, `${id}.png`));
  await sharp(buf).resize(192, 192).png().toFile(join(OUT, `${id}-preview.png`));
  // Android adaptive foreground: Cody only, inside the 66% safe zone.
  const fg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${codyLayer(id, 0.6)}</svg>`;
  await sharp(Buffer.from(fg)).png().toFile(join(OUT, `${id}-fg.png`));
}
console.log(`app icons: ${Object.keys(ICONS).length}`);
