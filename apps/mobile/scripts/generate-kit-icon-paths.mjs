/**
 * Regenerate kitIconPaths.ts from assets/kit/icons/*.svg (no runtime deps).
 * Run: node apps/mobile/scripts/generate-kit-icon-paths.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "assets/kit/icons");
const outFile = path.join(root, "src/components/kit/kitIconPaths.ts");

/** KitIconName → kit SVG filename (kebab). */
const MAP = {
  bookOpen: "book-open",
  gamepad2: "play",
  rotateCcw: "rotate-ccw",
  userRound: "user",
  flame: "flame",
  sparkles: "sparkles",
  chevronLeft: "chevron-left",
  chevronRight: "chevron-right",
  chevronDown: "chevron-down",
  settings: "settings",
  bell: "bell",
  check: "check",
  clock: "clock",
  moon: "moon",
  sun: "sun",
  logout: "log-out",
  shield: "shield-check",
  volume2: "volume-2",
  vibrate: "vibrate",
  accessibility: "circle-help",
  palette: "layers",
  share2: "share-2",
  download: "download",
  upload: "upload",
  info: "info",
  x: "x",
};

function parseSvg(svg) {
  const paths = [];
  const circles = [];
  const rects = [];
  for (const m of svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)) paths.push(m[1]);
  for (const m of svg.matchAll(/<circle[^>]*\scx="([^"]+)"[^>]*\scy="([^"]+)"[^>]*\sr="([^"]+)"/g)) {
    circles.push({ cx: m[1], cy: m[2], r: m[3] });
  }
  for (const m of svg.matchAll(/<rect([^/>]*)\/?>/g)) {
    const chunk = m[1];
    const pick = (k) => chunk.match(new RegExp(`${k}="([^"]+)"`))?.[1];
    rects.push({
      x: pick("x") ?? "0",
      y: pick("y") ?? "0",
      width: pick("width") ?? "0",
      height: pick("height") ?? "0",
      rx: pick("rx"),
    });
  }
  return { paths, circles, rects };
}

const icons = {};
for (const [name, file] of Object.entries(MAP)) {
  const svg = readFileSync(path.join(iconsDir, `${file}.svg`), "utf8");
  icons[name] = parseSvg(svg);
}

const names = Object.keys(MAP);
const typeUnion = names.map((n) => `  | "${n}"`).join("\n");

const body = `/** Lucide icons — generated from assets/kit/icons (run scripts/generate-kit-icon-paths.mjs). */
export type KitIconName =
${typeUnion};

export type KitIconShape = {
  paths: string[];
  circles: { cx: string; cy: string; r: string }[];
  rects: { x: string; y: string; width: string; height: string; rx?: string }[];
};

export const KIT_LUCIDE_ICONS: Record<KitIconName, KitIconShape> = ${JSON.stringify(icons, null, 2)};
`;

writeFileSync(outFile, body);
console.log("wrote", path.relative(root, outFile), "—", names.length, "icons");
