import type { Color, PieceType } from "./board";
import { PIECE_ART, PIECE_STROKE } from "./pieces";

/** One drawing format for every set, so web (<svg>) and native (react-native-svg) share a renderer. */
export type PieceOp =
  | { t: "path"; d: string; fill?: string; stroke?: string; sw?: number; lj?: string; lc?: string; fo?: number; fr?: string }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: string; stroke?: string; sw?: number };
export type PieceDrawing = { viewBox: string; ops: PieceOp[]; pixelated?: boolean };
export type PieceArtwork = { kind: "vector"; drawing: PieceDrawing } | { kind: "asset"; asset: string; pixelated?: boolean };

/** "toy" is the Classic set (its id predates the name). */
/**
 * Open-licence sets (commercial use allowed; credits in Settings → Looks and assets/pieces/CREDITS.md).
 * Drawn as image assets: web serves the SVGs, the app bundles PNGs rendered from them.
 */
const FREE_SETS = ["celtic", "classic", "spatial", "fantasy", "chessnut", "wood", "papercut"] as const;
type FreeSetId = (typeof FREE_SETS)[number];
export type PieceSetId = "toy" | FreeSetId;

export type PieceSetInfo = { id: PieceSetId; name: string; blurb: string; source: "chessschool" | "open"; credit?: string };

export const DEFAULT_PIECE_SET: PieceSetId = "celtic";

export const PIECE_SETS: readonly PieceSetInfo[] = [
  { id: "celtic", name: "Celtic", blurb: "Glossy and chunky", source: "open", credit: "Maurizio Monge, MIT" },
  { id: "classic", name: "Classic", blurb: "The standard set", source: "open", credit: "Colin M.L. Burnett, BSD" },
  { id: "spatial", name: "Spatial", blurb: "Sleek and modern", source: "open", credit: "Maurizio Monge, MIT" },
  { id: "fantasy", name: "Fantasy", blurb: "Detailed and ornate", source: "open", credit: "Maurizio Monge, MIT" },
  { id: "chessnut", name: "Chessnut", blurb: "Bold, clean outlines", source: "open", credit: "Alexis Luengas, Apache 2.0" },
  { id: "wood", name: "Wood", blurb: "Cute carved wood", source: "open", credit: "RhosGFX, CC0" },
  { id: "papercut", name: "Papercut", blurb: "Soft paper-cut look", source: "open", credit: "Nikolay Anzarov, CC BY 4.0" },
  { id: "toy", name: "Toy", blurb: "Chunky and friendly", source: "chessschool" },
];
export const isPieceSet = (v: unknown): v is PieceSetId => PIECE_SETS.some((s) => s.id === v);

/** Stored piece-set ids we no longer ship; a saved choice for one becomes the default set. */
const REMOVED_PIECE_SETS = new Set(["staunton", "flat", "chaturanga", "geometric", "bubble", "arcade", "bold", "heritage", "cartoon", "dubrovny", "kiwen-suwi", "clay", "pixel", "outline"]);

/** A saved preference for a removed set (or anything we don't ship) becomes the default set. */
export function migratePieceSet(v: unknown): PieceSetId {
  return isPieceSet(v) ? v : DEFAULT_PIECE_SET;
}

export const isRemovedPieceSet = (v: unknown): boolean => typeof v === "string" && REMOVED_PIECE_SETS.has(v);

const CLASSIC: Record<Color, { fill: string; stroke: string; detail: string; dot: string }> = {
  w: { fill: "#FFF7E8", stroke: "#2A2547", detail: "#B9B3D9", dot: "#2A2547" },
  b: { fill: "#3B3770", stroke: "#15132B", detail: "#7E79D6", dot: "#FFF7E8" },
};

function classic(color: Color, type: PieceType): PieceDrawing {
  const art = PIECE_ART[type];
  const p = CLASSIC[color];
  const ops: PieceOp[] = [];
  for (const d of art.body) ops.push({ t: "path", d, fill: p.fill, stroke: p.stroke, sw: PIECE_STROKE, lj: "round" });
  for (const d of art.detail) ops.push({ t: "path", d, fill: "none", stroke: p.detail, sw: 3.5, lc: "round" });
  for (const [cx, cy, r] of art.dots ?? []) ops.push({ t: "circle", cx, cy, r, fill: p.dot });
  return { viewBox: "0 0 100 100", ops };
}

const cache = new Map<string, PieceArtwork>();

/** Artwork for one piece in a set. Unknown sets fall back to Toy. */
export function pieceArtwork(set: PieceSetId, color: Color, type: PieceType): PieceArtwork {
  const key = `${set}${color}${type}`;
  let art = cache.get(key);
  if (!art) {
    art = (FREE_SETS as readonly string[]).includes(set) ? { kind: "asset", asset: `${set}/${color}${type.toUpperCase()}` } : { kind: "vector", drawing: classic(color, type) };
    cache.set(key, art);
  }
  return art;
}
