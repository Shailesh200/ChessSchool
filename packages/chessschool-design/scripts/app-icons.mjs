#!/usr/bin/env node
// Generates the switchable app icons from Chaukor's vector rig (assets/svg/cody.svg).
//   node scripts/app-icons.mjs   (from packages/chessschool-design)
// Outputs assets/raster/app-icons/<id>.png (1024, opaque: iOS + web), <id>-bg.png (Android adaptive
// background), <id>-fg.png (Android adaptive foreground) and <id>-preview.png (192, for pickers).
// Each icon is a little scene: a background, Chaukor, and sometimes something he wears.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(PKG, "assets/raster/app-icons");
mkdirSync(OUT, { recursive: true });
const cody = readFileSync(join(PKG, "assets/svg/cody.svg"), "utf8");
const codyInner = cody.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
/** Chaukor without the gem above his head, for icons where he wears something instead. */
const codyBare = codyInner.replace(/<g id="spark"[\s\S]*?<\/g>/, "");

/* ---------- background pieces (1024 canvas) ---------- */
const grad = (id, a, b, x2 = 1, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const fill = (a, b, x2, y2) => `<defs>${grad("bg", a, b, x2, y2)}</defs><rect width="1024" height="1024" fill="url(#bg)"/>`;
const radial = (c, o, r = 420, cy = 560) => `<defs><radialGradient id="glow"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><circle cx="512" cy="${cy}" r="${r}" fill="url(#glow)"/>`;

/** Faint checkerboard in one corner, fading out. */
function checkerCorner(color, o) {
  let s = "";
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if ((x + y) % 2 === 0 && x + y < 6) s += `<rect x="${x * 72}" y="${y * 72}" width="72" height="72" fill="${color}" opacity="${(o * (6 - x - y)) / 6}"/>`;
  return s + s.replace(/x="(\d+)"/g, (_, x) => `x="${952 - Number(x)}"`).replace(/y="(\d+)"/g, (_, y) => `y="${952 - Number(y)}"`);
}
function rays(color, o, n = 16) {
  let s = "";
  for (let i = 0; i < n; i += 2) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 1) / n) * Math.PI * 2;
    s += `<path d="M512 560L${512 + 900 * Math.cos(a)} ${560 + 900 * Math.sin(a)}L${512 + 900 * Math.cos(b)} ${560 + 900 * Math.sin(b)}Z" fill="${color}" opacity="${o}"/>`;
  }
  return s;
}
/** A cusped Mughal arch framing Chaukor. */
function arch(color, o) {
  const d = "M190 1024V520Q190 330 330 250Q420 200 512 120Q604 200 694 250Q834 330 834 520V1024";
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="34" opacity="${o}"/><path d="M240 1024V530Q240 360 360 292Q440 250 512 186Q584 250 664 292Q784 360 784 530V1024" fill="${color}" opacity="${o * 0.45}"/>`;
}
function leaves(color, o) {
  const leaf = (x, y, r) => `<path d="M0 0Q40 -46 0 -110Q-40 -46 0 0Z" transform="translate(${x} ${y}) rotate(${r})" fill="${color}" opacity="${o}"/>`;
  return [leaf(110, 980, -30), leaf(150, 990, 5), leaf(70, 940, -60), leaf(914, 980, 30), leaf(874, 990, -5), leaf(954, 940, 60)].join("");
}
function waves(colors) {
  return colors
    .map((c, i) => {
      const y = 800 + i * 70 + (i % 2) * 10;
      let d = `M0 ${y}`;
      for (let x = 0; x < 1024; x += 256) d += `C${x + 64} ${y - 30} ${x + 64} ${y - 30} ${x + 128} ${y}S${x + 192} ${y + 30} ${x + 256} ${y}`;
      return `<path d="${d}V1024H0Z" fill="${c}"/>`;
    })
    .join("");
}
const bubbles = (c) => [[170, 260, 26], [230, 180, 14], [860, 340, 22], [820, 250, 12], [130, 420, 10]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="8" opacity="0.55"/>`).join("");
function shelves() {
  const spines = ["#C8553D", "#F2B544", "#3E7C6B", "#6C5BB0", "#E8DCC4", "#9B3D2E"];
  let s = "";
  for (const y of [70, 330]) {
    let x = 40;
    let i = 0;
    while (x < 990) {
      const w = 34 + ((i * 37) % 30);
      const h = 150 + ((i * 53) % 60);
      s += `<rect x="${x}" y="${y + 210 - h}" width="${w}" height="${h}" rx="6" fill="${spines[i % spines.length]}" opacity="0.45"/>`;
      x += w + 8;
      i++;
    }
    s += `<rect x="0" y="${y + 210}" width="1024" height="22" fill="#2E1A0A" opacity="0.5"/>`;
  }
  return s;
}
function stars(c) {
  const pts = [[150, 180, 9], [300, 110, 6], [860, 520, 7], [120, 520, 6], [700, 120, 5], [920, 760, 8], [90, 800, 7], [420, 70, 4], [250, 330, 4], [800, 380, 4]];
  const star = (x, y, r) => `<path d="M${x} ${y - r * 2.4}L${x + r * 0.6} ${y - r * 0.6}L${x + r * 2.4} ${y}L${x + r * 0.6} ${y + r * 0.6}L${x} ${y + r * 2.4}L${x - r * 0.6} ${y + r * 0.6}L${x - r * 2.4} ${y}L${x - r * 0.6} ${y - r * 0.6}Z" fill="${c}"/>`;
  return pts.map(([x, y, r]) => star(x, y, r)).join("") + `<path d="M840 140A110 110 0 1 0 930 300A90 90 0 1 1 840 140Z" fill="#FFE8A3"/>`;
}
function pixelGrid() {
  let s = "";
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2 === 0) s += `<rect x="${x * 64}" y="${y * 64}" width="64" height="64" fill="#FFFFFF" opacity="0.07"/>`;
  return s;
}
/** A gold rangoli ring: petals around a circle. */
function rangoli(c) {
  let s = `<circle cx="512" cy="540" r="408" fill="none" stroke="${c}" stroke-width="10" opacity="0.9"/><circle cx="512" cy="540" r="440" fill="none" stroke="${c}" stroke-width="4" opacity="0.6"/>`;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = 512 + 424 * Math.cos(a);
    const y = 540 + 424 * Math.sin(a);
    s += `<circle cx="${x}" cy="${y}" r="9" fill="${c}"/>`;
  }
  return s;
}

/* ---------- things Chaukor wears (512 rig coordinates, over his head at y≈222) ---------- */
const CROWN = `<path d="M188 230L176 150L222 190L256 128L290 190L336 150L324 230Z" fill="#F6C343" stroke="#A67C12" stroke-width="8" stroke-linejoin="round"/><circle cx="176" cy="146" r="12" fill="#F6C343" stroke="#A67C12" stroke-width="6"/><circle cx="256" cy="122" r="13" fill="#F6C343" stroke="#A67C12" stroke-width="6"/><circle cx="336" cy="146" r="12" fill="#F6C343" stroke="#A67C12" stroke-width="6"/><circle cx="256" cy="200" r="11" fill="#E0457B"/>`;
const CAP = `<path d="M206 196V232H306V196Z" fill="#2B2850"/><path d="M256 140L370 180L256 220L142 180Z" fill="#3A3670" stroke="#1C1A38" stroke-width="6" stroke-linejoin="round"/><path d="M256 180L346 196V250" fill="none" stroke="#F6C343" stroke-width="7" stroke-linecap="round"/><circle cx="346" cy="256" r="11" fill="#F6C343"/>`;

/** Background markup (1024 canvas), Android background colour, and what Chaukor wears. */
export const ICONS = {
  classroom: { bg: fill("#FFF6EE", "#FFDCCB") + checkerCorner("#FF7A59", 0.12), color: "#FFE9DC", wear: null },
  sunset: { bg: fill("#FFD98A", "#F2795B", 0, 1) + rays("#FFFFFF", 0.16) + `<circle cx="512" cy="560" r="330" fill="#FFF1C9" opacity="0.5"/>`, color: "#F59E5B", wear: null },
  garden: { bg: fill("#3E9A6E", "#1F5E43") + arch("#BFE8C9", 0.32) + leaves("#BFE8C9", 0.45), color: "#2F7D5B", wear: null },
  ocean: { bg: fill("#36BCCB", "#0E6B7C", 0, 1) + bubbles("#E6FBFF") + waves(["#1394A6", "#0D7E90", "#0A6B7B"]), color: "#117A8C", wear: null, front: waves(["#1BA3B5"]).replace(/800/g, "900") },
  library: { bg: fill("#8B5A2B", "#4E2E14", 0, 1) + shelves() + radial("#FFE2B0", 0.35, 360), color: "#6B3F1F", wear: CAP },
  night: { bg: fill("#2A2D6E", "#0B0C1E", 0, 1) + radial("#6363E0", 0.5) + stars("#F8E7B0"), color: "#14152B", wear: null },
  pixel: { bg: fill("#8A6CF7", "#3B2A8C") + pixelGrid(), color: "#6C4BD8", wear: null },
  midnight: { bg: `<rect width="1024" height="1024" fill="#0B0B12"/>` + radial("#E3B341", 0.18, 460) + rangoli("#E3B341"), color: "#0B0B12", wear: CROWN },
};

/** Chaukor's own box inside the 512 canvas (gem to shadow), so `scale` is the share of the icon he fills. */
export const CHAUKOR_BOX = "86 100 340 360";

function codyLayer(icon, scale) {
  const size = 1024 * scale;
  const off = (1024 - size) / 2;
  const body = icon.wear ? codyBare + icon.wear : codyInner;
  return `<svg x="${off}" y="${off + 10}" width="${size}" height="${size}" viewBox="${CHAUKOR_BOX}">${body}</svg>`;
}

const svg = (inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${inner}</svg>`);
for (const [id, icon] of Object.entries(ICONS)) {
  let img = sharp(svg(icon.bg + codyLayer(icon, 0.72) + (icon.front ?? ""))).flatten({ background: "#000" });
  // Arcade: the whole scene drawn as chunky pixels.
  if (id === "pixel") img = sharp(await img.resize(96, 96, { kernel: "nearest" }).png().toBuffer()).resize(1024, 1024, { kernel: "nearest" });
  const buf = await img.png().toBuffer();
  await sharp(buf).toFile(join(OUT, `${id}.png`));
  await sharp(buf).resize(192, 192).png().toFile(join(OUT, `${id}-preview.png`));
  // Android adaptive icon: the scene as the background layer, Chaukor inside the 66% safe zone in front.
  let bg = sharp(svg(icon.bg)).flatten({ background: "#000" });
  if (id === "pixel") bg = sharp(await bg.resize(96, 96, { kernel: "nearest" }).png().toBuffer()).resize(1024, 1024, { kernel: "nearest" });
  await bg.png().toFile(join(OUT, `${id}-bg.png`));
  await sharp(svg(codyLayer(icon, 0.52))).png().toFile(join(OUT, `${id}-fg.png`));
}
console.log(`app icons: ${Object.keys(ICONS).length}`);
