import { PIECE_ART, PIECE_COLORS, PIECE_STROKE } from "@chessschool/chess";
import { copy, palettes, setLanguage, type AvatarId, type Lang } from "@chessschool/design";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { Chess } from "chess.js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "uqr";
// harfbuzzjs 0.4: CommonJS, and takes its wasm as bytes, so it bundles into the Vercel function.
import hbFactory from "harfbuzzjs/hb.js";
import hbjs from "harfbuzzjs/hbjs.js";
import { xml } from "./certificate";

export const CARD_KINDS = ["game_won", "puzzle_streak", "rating_milestone", "certificate", "league_promotion", "mate_of_the_day", "weekly"] as const;
export type CardKind = (typeof CARD_KINDS)[number];
export const isCardKind = (v: unknown): v is CardKind => CARD_KINDS.includes(v as CardKind);
export const CARD_W = 1080;
export const CARD_H = 1920;
/** Bump when the layout changes so cached PNGs are made again. */
export const CARD_VERSION = 1;
export const SHARE_ORIGIN = "https://chess-school.in";

/** What a learner chose to put on a card. Numbers and short words only; never free text from a child. */
export type CardData = { fen?: string; moves?: number; streak?: number; rating?: number; unit?: string; league?: string; mate?: number; lessons?: number; puzzles?: number };
export type Card = { kind: CardKind; lang: Lang; data: CardData; avatar: AvatarId; name: string | null };

const int = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : undefined);
/** Course titles and league names: letters, digits, spaces and light punctuation. */
const word = (v: unknown) => (typeof v === "string" && /^[\p{L}\p{M}\p{N} '’&:,.()-]{1,60}$/u.test(v.trim()) ? v.trim() : undefined);
function fenOf(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 100) return undefined;
  try {
    return new Chess(v).fen();
  } catch {
    return undefined;
  }
}

/** The fields each kind needs; anything else in the body is dropped. Null when a required field is missing. */
export function cardData(kind: CardKind, raw: unknown): CardData | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fen = fenOf(r.fen);
  const pick = (d: CardData) => Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) as CardData;
  switch (kind) {
    case "game_won":
      return fen ? pick({ fen, moves: int(r.moves, 500) }) : null;
    case "puzzle_streak":
      return int(r.streak, 10_000) ? pick({ fen, streak: int(r.streak, 10_000) }) : null;
    case "rating_milestone":
      return int(r.rating, 4000) ? pick({ fen, rating: int(r.rating, 4000) }) : null;
    case "certificate":
      return word(r.unit) ? pick({ fen, unit: word(r.unit) }) : null;
    case "league_promotion":
      return word(r.league) ? pick({ fen, league: word(r.league) }) : null;
    case "mate_of_the_day":
      return fen ? pick({ fen, mate: int(r.mate, 20) }) : null;
    case "weekly":
      return pick({ lessons: int(r.lessons, 1000) ?? 0, puzzles: int(r.puzzles, 10_000) ?? 0, streak: int(r.streak, 10_000) ?? 0 });
  }
}

/** Stable id for a card's content: the same share twice gets the same link and the same cached PNG. */
export const cardId = (card: Card) => createHash("sha256").update(JSON.stringify([CARD_VERSION, card.kind, card.lang, card.data, card.avatar, card.name])).digest("base64url").slice(0, 12);

/** Card words in `lang`. setLanguage is synchronous, so nothing else can see the switch. */
function words(lang: Lang) {
  setLanguage(lang);
  const t = { cards: { ...copy.share.cards }, scan: copy.share.scan };
  setLanguage("en");
  return t;
}

type Stat = { value: string; label: string };
function textOf(card: Card): { headline: string; stats: Stat[] } {
  const t = words(card.lang).cards;
  const d = card.data;
  switch (card.kind) {
    case "game_won":
      return { headline: t.gameWon, stats: d.moves ? [{ value: String(d.moves), label: t.moves }] : [] };
    case "puzzle_streak":
      return { headline: t.puzzleStreak, stats: [{ value: String(d.streak), label: t.inARow }] };
    case "rating_milestone":
      return { headline: t.rating, stats: [{ value: String(d.rating), label: t.ratingLabel }] };
    case "certificate":
      return { headline: t.certificate, stats: [{ value: d.unit!, label: t.unit }] };
    case "league_promotion":
      return { headline: t.league, stats: [{ value: d.league!, label: t.leagueLabel }] };
    case "mate_of_the_day":
      return { headline: t.mate, stats: d.mate ? [{ value: String(d.mate), label: t.mateIn }] : [] };
    case "weekly":
      return {
        headline: t.weekly,
        stats: [
          { value: String(d.lessons ?? 0), label: t.lessons },
          { value: String(d.puzzles ?? 0), label: t.puzzles },
          { value: String(d.streak ?? 0), label: t.streak },
        ],
      };
  }
}

/* ---------- assets: from the repo in dev and tests, from card-assets/ next to the Vercel bundle ---------- */

/** This file's folder. The Vercel bundle is CommonJS (no import.meta.url): its card-assets/ folder sits next to index.js. */
function here(): string {
  if (typeof __dirname === "string") return __dirname;
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
}
/** Card asset name -> path inside the repo, relative to this file. scripts/build-vercel.mjs copies the same list. */
export const CARD_ASSETS: Record<string, string> = {
  "Baloo2_700Bold.ttf": "../assets/cards/Baloo2_700Bold.ttf",
  "cody.svg": "../../../packages/chessschool-design/assets/svg/cody.svg",
  ...Object.fromEntries(["ash", "kira", "otto", "rex", "skye"].map((c) => [`${c}.png`, `../../chessschool/assets/coaches/${c}.png`])),
};
function asset(name: string): Buffer {
  const dir = here();
  const bundled = join(dir, "card-assets", name);
  if (existsSync(bundled)) return readFileSync(bundled);
  // Dev and tests: straight from node_modules and the repo. Nothing here runs when the module loads.
  const require_ = createRequire(join(dir, "share-card.js"));
  if (name === "resvg.wasm") return readFileSync(require_.resolve("@resvg/resvg-wasm/index_bg.wasm"));
  if (name === "hb.wasm") return readFileSync(require_.resolve("harfbuzzjs/hb.wasm"));
  return readFileSync(join(dir, CARD_ASSETS[name]!));
}

let wasmReady: Promise<void> | null = null;
type Glyph = { g: number; ax: number; dx: number; dy: number };
type Shaper = { shape: (text: string) => Glyph[]; path: (g: number) => string; upem: number };
let shaper: Shaper | null = null;

/**
 * Text is drawn as glyph outlines shaped by HarfBuzz: resvg's own text layout drops Devanagari
 * vowel signs, so Hindi cards would be misspelled. Baloo 2 covers Latin and Devanagari.
 */
async function loadShaper(): Promise<Shaper> {
  const hb = hbjs(await hbFactory({ wasmBinary: asset("hb.wasm") }));
  const face = hb.createFace(hb.createBlob(asset("Baloo2_700Bold.ttf")), 0);
  const font = hb.createFont(face);
  const paths = new Map<number, string>();
  return {
    upem: face.upem,
    shape(text) {
      const buf = hb.createBuffer();
      buf.addText(text);
      buf.guessSegmentProperties();
      hb.shape(font, buf);
      const out = buf.json() as Glyph[];
      buf.destroy();
      return out;
    },
    path: (g) => paths.get(g) ?? (paths.set(g, font.glyphToPath(g)), paths.get(g)!),
  };
}

/** One line of text as filled outlines; `anchor` places x at the start, middle or end of the line. */
function txt(text: string, x: number, y: number, size: number, fill: string, anchor: "start" | "middle" = "start") {
  const sh = shaper!;
  const glyphs = sh.shape(text);
  const k = size / sh.upem;
  const width = glyphs.reduce((w, g) => w + g.ax, 0);
  let pen = 0;
  let d = "";
  for (const g of glyphs) {
    const p = sh.path(g.g);
    if (p) d += `<path transform="translate(${pen + g.dx} ${g.dy})" d="${p}"/>`;
    pen += g.ax;
  }
  const x0 = anchor === "middle" ? x - (width * k) / 2 : x;
  return `<g aria-label="${xml(text)}" fill="${fill}" transform="translate(${x0.toFixed(1)} ${y}) scale(${k.toFixed(5)} ${(-k).toFixed(5)})">${d}</g>\n`;
}
const cache = new Map<string, string>();
const once = (name: string, make: () => string) => cache.get(name) ?? (cache.set(name, make()), cache.get(name)!);

/** Cody, inlined as a nested SVG at (x, y) and `size` square. */
const cody = (x: number, y: number, size: number) =>
  once("cody", () => asset("cody.svg").toString("utf8").replace(/<\?xml[^>]*>/, "")).replace("<svg ", `<svg x="${x}" y="${y}" width="${size}" height="${size}" `);

function avatarSvg(avatar: AvatarId, cx: number, cy: number, r: number) {
  const ring = `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="#FFFFFF"/>`;
  if (avatar === "cody") return `${ring}<circle cx="${cx}" cy="${cy}" r="${r}" fill="#EEF0FF"/>${cody(cx - r, cy - r, r * 2)}`;
  const png = once(avatar, () => asset(`${avatar}.png`).toString("base64"));
  return `${ring}<clipPath id="av"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><image x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#av)" href="data:image/png;base64,${png}"/>`;
}

function boardSvg(fen: string, x: number, y: number, size: number) {
  const p = palettes.light;
  const sq = size / 8;
  const rows = new Chess(fen).board();
  let out = `<rect x="${x - 12}" y="${y - 12}" width="${size + 24}" height="${size + 24}" rx="28" fill="#FFFFFF"/>`;
  rows.forEach((row, r) =>
    row.forEach((cell, f) => {
      const sx = x + f * sq;
      const sy = y + r * sq;
      out += `<rect x="${sx}" y="${sy}" width="${sq}" height="${sq}" fill="${(r + f) % 2 ? p.boardDark : p.boardLight}"/>`;
      if (!cell) return;
      const art = PIECE_ART[cell.type];
      const c = PIECE_COLORS[cell.color];
      out += `<g transform="translate(${sx} ${sy}) scale(${sq / 100})" stroke-linejoin="round" stroke-linecap="round">`;
      for (const d of art.body) out += `<path d="${d}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${PIECE_STROKE}"/>`;
      for (const d of art.detail) out += `<path d="${d}" fill="none" stroke="${c.detail}" stroke-width="${PIECE_STROKE}"/>`;
      for (const [dx, dy, dr] of art.dots ?? []) out += `<circle cx="${dx}" cy="${dy}" r="${dr}" fill="${c.dot}"/>`;
      out += "</g>";
    }),
  );
  return out;
}

function qrSvg(text: string, x: number, y: number, size: number) {
  const { data } = encode(text, { ecc: "M", border: 2 });
  const cell = size / data.length;
  let d = "";
  data.forEach((row, r) => row.forEach((on, c) => (d += on ? `M${(x + c * cell).toFixed(2)} ${(y + r * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}Z` : "")));
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="16" fill="#FFFFFF"/><path d="${d}" fill="#1C1B2E"/>`;
}

/** Word-wraps to at most `lines` lines of about `max` characters. */
function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  for (const w of text.split(/\s+/)) {
    const last = out.at(-1);
    if (last !== undefined && (last + " " + w).length <= max) out[out.length - 1] = `${last} ${w}`;
    else out.push(w);
  }
  return out.length > lines ? [...out.slice(0, lines - 1), out.slice(lines - 1).join(" ")] : out;
}

/** The card as SVG (call `loadCardRenderer` first). Text is drawn as outlines, so nothing in it is markup. */
export function cardSvg(card: Card, id: string): string {
  const p = palettes.light;
  const { headline, stats } = textOf(card);
  const scan = words(card.lang).scan;
  const url = `${SHARE_ORIGIN}/s/${id}`;
  const head = wrap(headline, 20, 2);
  const hasBoard = Boolean(card.data.fen);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
<defs><linearGradient id="bgfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.brand}"/><stop offset="1" stop-color="${p.brandEdge}"/></linearGradient></defs>
<rect width="${CARD_W}" height="${CARD_H}" fill="url(#bgfill)"/>
${txt("ChessSchool", 540, 130, 56, "#FFFFFF", "middle")}${cody(400, 170, 280)}
`;
  head.forEach((line, i) => (s += txt(line, 540, 560 + i * 84, line.length > 22 ? 60 : 76, "#FFFFFF", "middle")));
  let y = 560 + head.length * 84 + 20;
  // The learner: avatar always, first name only when they chose to show it (never for a child profile).
  if (card.name) {
    s += avatarSvg(card.avatar, 410, y + 48, 48);
    s += txt(card.name, 480, y + 66, 48, "#FFFFFF");
  } else s += avatarSvg(card.avatar, 540, y + 48, 48);
  y += 130;
  const statY = hasBoard ? y : y + 220;
  const colW = CARD_W / Math.max(1, stats.length);
  stats.forEach((st, i) => {
    const cx = colW * i + colW / 2;
    const size = st.value.length > 8 ? Math.max(48, Math.floor(820 / st.value.length / 0.55 / stats.length)) : 120;
    s += txt(st.value, cx, statY + 110, Math.min(120, size), p.gold, "middle");
    s += txt(st.label, cx, statY + 170, 40, "#E4E2FB", "middle");
  });
  if (hasBoard) s += boardSvg(card.data.fen!, 270, Math.max(statY + (stats.length ? 220 : 0), 1000), 540);
  s += qrSvg(url, 800, 1690, 200);
  s += txt(scan, 90, 1772, scan.length > 30 ? 36 : 44, "#FFFFFF");
  s += txt(`chess-school.in/s/${id}`, 90, 1836, 36, "#E4E2FB");
  return `${s}</svg>`;
}

/** Renders the card to a 1080x1920 PNG. */
export async function loadCardRenderer() {
  wasmReady ??= Promise.all([initWasm(asset("resvg.wasm")), loadShaper().then((sh) => void (shaper = sh))]).then(() => undefined).catch((err) => {
    wasmReady = null;
    throw err;
  });
  await wasmReady;
}

export async function renderCard(card: Card, id: string): Promise<Uint8Array> {
  await loadCardRenderer();
  const r = new Resvg(cardSvg(card, id), { fitTo: { mode: "original" }, font: { loadSystemFonts: false } });
  try {
    return r.render().asPng();
  } finally {
    r.free();
  }
}

/* ---------- R2 cache (same R2_* settings as the coach voice clips) ---------- */

/** Rendered cards by key. Production uses R2; tests pass an in-memory store. */
export type CardStore = { get: (key: string) => Promise<Uint8Array | null>; put: (key: string, png: Uint8Array) => Promise<void> };

export async function cardStoreFromEnv(env: NodeJS.ProcessEnv): Promise<CardStore | null> {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) return null;
  const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
  const client = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } });
  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  return {
    async get(key) {
      const res = await fetch(`${base}/${key}`).catch(() => null);
      return res?.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    },
    async put(key, png) {
      await client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: png, ContentType: "image/png", CacheControl: "public, max-age=31536000, immutable" }));
    },
  };
}
