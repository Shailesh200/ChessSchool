#!/usr/bin/env node
/**
 * Bundle Lichess piece SVGs from apps/web/public/pieces into Path lists for
 * react-native-svg. SvgXml / SVG data-URI Image is unreliable on native RN —
 * Path components match Marble and always paint.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "apps/web/public/pieces");
const OUT_PATHS = path.join(ROOT, "apps/mobile/src/pieceSvgPaths.ts");
const OUT_SVG = path.join(ROOT, "apps/mobile/src/pieceSvgContent.ts");

const SETS = [
  "cburnett",
  "merida",
  "alpha",
  "spatial",
  "pixel",
  "dubrovny",
  "chessnut",
  "kiwen-suwi",
  "fairytale",
  "anime",
  "fantasy",
];

const CODES = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"];

function parseClassRules(cssText) {
  const rules = new Map();
  for (const m of cssText.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g)) {
    rules.set(m[1], m[2].replace(/\s+/g, " ").trim());
  }
  return rules;
}

function inlineSvgStyles(svg) {
  const styleMatch = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!styleMatch) return svg;

  const rules = parseClassRules(styleMatch[1]);
  if (rules.size === 0) return svg.replace(styleMatch[0], "");

  let out = svg.replace(styleMatch[0], "");
  out = out.replace(/<([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g, (full, tag, attrs, selfClose) => {
    const classMatch = attrs.match(/\sclass="([^"]+)"/);
    if (!classMatch) return full;

    const fromClass = classMatch[1]
      .split(/\s+/)
      .map((c) => rules.get(c))
      .filter(Boolean)
      .join(";");

    let nextAttrs = attrs.replace(/\sclass="[^"]+"/, "");
    const existing = nextAttrs.match(/\sstyle="([^"]*)"/);
    if (existing) {
      const merged = [fromClass, existing[1]].filter(Boolean).join(";");
      nextAttrs = nextAttrs.replace(/\sstyle="[^"]*"/, ` style="${merged}"`);
    } else if (fromClass) {
      nextAttrs += ` style="${fromClass}"`;
    }

    return `<${tag}${nextAttrs}${selfClose}>`;
  });
  return out;
}

function normalizeKiwenSuwi(svg) {
  return svg
    .replace(/<defs>\s*<clipPath[^>]*>[\s\S]*?<\/clipPath>\s*<\/defs>/gi, "")
    .replace(/\sclip-path="url\([^"]+\)"/gi, "")
    .replace(/\soverflow="hidden"/gi, "");
}

function ensureViewBox(svg) {
  if (/viewBox=/i.test(svg)) return svg;
  const w = svg.match(/\bwidth="(\d+(?:\.\d+)?)/);
  const h = svg.match(/\bheight="(\d+(?:\.\d+)?)/);
  if (!w || !h) return svg;
  return svg.replace(/<svg\b/, `<svg viewBox="0 0 ${w[1]} ${h[1]}"`);
}

function normalizePieceSvg(set, svg) {
  let out = svg.trim();
  if (set === "kiwen-suwi") out = normalizeKiwenSuwi(out);
  out = inlineSvgStyles(out);
  out = ensureViewBox(out);
  return out;
}

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return m ? m[1] : undefined;
}

function styleProp(style, name) {
  if (!style) return undefined;
  const m = style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i"));
  return m ? m[1].trim() : undefined;
}

function pick(attrs, name, styleName = name) {
  return attr(attrs, name) ?? styleProp(attr(attrs, "style"), styleName);
}

/** Resolve fill/stroke paint, including url(#id) → solid stop color. */
function resolvePaint(value, paints) {
  if (!value || value === "none") return value;
  const ref = value.match(/^url\(#([^)]+)\)$/);
  if (!ref) return value;
  return paints.get(ref[1]) ?? "#888888";
}

function buildPaintMap(svg) {
  const paints = new Map();
  const blocks = [...svg.matchAll(/<(linearGradient|radialGradient)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];

  // First pass: gradients with their own stops
  for (const m of blocks) {
    const id = attr(m[2], "id");
    if (!id) continue;
    const stopColors = [...m[3].matchAll(/stop-color:\s*([^;"'\s]+)|stop-color="([^"]+)"/gi)].map(
      (s) => s[1] || s[2],
    );
    if (stopColors.length) paints.set(id, stopColors[0]);
  }

  // Second pass: xlink:href / href references
  for (const m of blocks) {
    const id = attr(m[2], "id");
    if (!id || paints.has(id)) continue;
    const href = attr(m[2], "xlink:href") ?? attr(m[2], "href");
    if (!href?.startsWith("#")) continue;
    const target = paints.get(href.slice(1));
    if (target) paints.set(id, target);
  }

  return paints;
}

function parseViewBox(svg) {
  const vb = svg.match(/\bviewBox="([^"]+)"/i)?.[1];
  if (vb) return vb.trim().replace(/\s+/g, " ");
  return "0 0 45 45";
}

/**
 * Flatten SVG into drawable path/circle ops with inherited group paints.
 * Skips defs (gradients already resolved to solids).
 */
function svgToOps(svg) {
  const paints = buildPaintMap(svg);
  const viewBox = parseViewBox(svg);
  const ops = [];

  // Strip defs so we don't emit gradient children as shapes
  const body = svg.replace(/<defs\b[\s\S]*?<\/defs>/gi, "");

  const stack = [{ fill: undefined, stroke: undefined, sw: undefined, lj: undefined, lc: undefined, fo: undefined }];

  const tokenRe = /<\/?([a-zA-Z][\w:-]*)\b([^>]*)\/?>/g;
  let m;
  while ((m = tokenRe.exec(body))) {
    const full = m[0];
    const tag = m[1].toLowerCase();
    const attrs = m[2] ?? "";
    const closing = full.startsWith("</");
    const selfClosing = /\/>$/.test(full);

    if (closing) {
      if (tag === "g" || tag === "svg") stack.pop();
      continue;
    }

    const parent = stack[stack.length - 1] ?? {};
    const fill = pick(attrs, "fill") ?? parent.fill;
    const stroke = pick(attrs, "stroke") ?? parent.stroke;
    const sw = pick(attrs, "stroke-width", "stroke-width") ?? parent.sw;
    const lj = pick(attrs, "stroke-linejoin", "stroke-linejoin") ?? parent.lj;
    const lc = pick(attrs, "stroke-linecap", "stroke-linecap") ?? parent.lc;
    const fo = pick(attrs, "fill-opacity", "fill-opacity") ?? parent.fo;
    const fr = pick(attrs, "fill-rule", "fill-rule");

    if (tag === "g" || tag === "svg") {
      if (!selfClosing) {
        stack.push({
          fill,
          stroke,
          sw,
          lj,
          lc,
          fo,
        });
      }
      continue;
    }

    if (tag === "path") {
      const d = attr(attrs, "d");
      if (!d) continue;
      ops.push({
        t: "path",
        d,
        fill: resolvePaint(fill, paints),
        stroke: resolvePaint(stroke, paints),
        sw: sw ? Number(sw) : undefined,
        lj,
        lc,
        fo: fo ? Number(fo) : undefined,
        fr,
      });
      continue;
    }

    if (tag === "circle") {
      const cx = Number(attr(attrs, "cx") ?? 0);
      const cy = Number(attr(attrs, "cy") ?? 0);
      const r = Number(attr(attrs, "r") ?? 0);
      if (!r) continue;
      ops.push({
        t: "circle",
        cx,
        cy,
        r,
        fill: resolvePaint(fill, paints),
        stroke: resolvePaint(stroke, paints),
        sw: sw ? Number(sw) : undefined,
      });
      continue;
    }

    if (tag === "ellipse") {
      const cx = Number(attr(attrs, "cx") ?? 0);
      const cy = Number(attr(attrs, "cy") ?? 0);
      const rx = Number(attr(attrs, "rx") ?? 0);
      const ry = Number(attr(attrs, "ry") ?? 0);
      if (!rx || !ry) continue;
      ops.push({
        t: "ellipse",
        cx,
        cy,
        rx,
        ry,
        fill: resolvePaint(fill, paints),
        stroke: resolvePaint(stroke, paints),
        sw: sw ? Number(sw) : undefined,
      });
      continue;
    }
  }

  return { viewBox, ops };
}

const svgMap = {};
const pathMap = {};
let missing = 0;
let emptyOps = 0;

for (const set of SETS) {
  svgMap[set] = {};
  pathMap[set] = {};
  for (const code of CODES) {
    const file = path.join(SRC, set, `${code}.svg`);
    if (!fs.existsSync(file)) {
      console.warn(`missing: ${set}/${code}.svg`);
      missing++;
      continue;
    }
    const raw = fs.readFileSync(file, "utf8").trim();
    const normalized = normalizePieceSvg(set, raw);
    svgMap[set][code] = normalized;
    const parsed = svgToOps(normalized);
    pathMap[set][code] = parsed;
    if (!parsed.ops.length) {
      console.warn(`no drawable ops: ${set}/${code}`);
      emptyOps++;
    }
  }
}

if (missing > 0) {
  console.error(`Abort: ${missing} piece SVG(s) missing under ${SRC}`);
  process.exit(1);
}
if (emptyOps > 0) {
  console.error(`Abort: ${emptyOps} piece(s) produced zero drawable ops`);
  process.exit(1);
}

const header = `/** Auto-generated by scripts/generate-piece-assets.mjs — do not edit. */\n\n`;

fs.writeFileSync(
  OUT_SVG,
  header +
    `export const PIECE_SVG: Record<string, Record<string, string>> = ${JSON.stringify(svgMap, null, 2)};\n\n` +
    `export function getPieceSvg(set: string, code: string): string | null {\n  return PIECE_SVG[set]?.[code] ?? null;\n}\n`,
);

fs.writeFileSync(
  OUT_PATHS,
  header +
    `export type PieceOp =\n` +
    `  | { t: "path"; d: string; fill?: string; stroke?: string; sw?: number; lj?: string; lc?: string; fo?: number; fr?: string }\n` +
    `  | { t: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number }\n` +
    `  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: string; stroke?: string; sw?: number };\n\n` +
    `export type PieceDrawing = { viewBox: string; ops: PieceOp[] };\n\n` +
    `export const PIECE_PATHS: Record<string, Record<string, PieceDrawing>> = ${JSON.stringify(pathMap)};\n\n` +
    `export function getPieceDrawing(set: string, code: string): PieceDrawing | null {\n  return PIECE_PATHS[set]?.[code] ?? null;\n}\n`,
);

console.log(`Wrote ${OUT_PATHS}`);
console.log(`Wrote ${OUT_SVG}`);
console.log(`${SETS.length} sets × ${CODES.length} pieces → Path ops for native rendering`);
