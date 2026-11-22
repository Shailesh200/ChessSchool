import type { Color, PieceType } from "./board";
import { EXTRA_SETS, type ExtraSetId } from "./pieceSets.extra";
import { PIECE_ART, PIECE_STROKE } from "./pieces";

/** One drawing format for every set, so web (<svg>) and native (react-native-svg) share a renderer. */
export type PieceOp =
  | { t: "path"; d: string; fill?: string; stroke?: string; sw?: number; lj?: string; lc?: string; fo?: number; fr?: string }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: string; stroke?: string; sw?: number };
export type PieceDrawing = { viewBox: string; ops: PieceOp[]; pixelated?: boolean };
export type PieceArtwork = { kind: "vector"; drawing: PieceDrawing } | { kind: "asset"; asset: string; pixelated?: boolean };

/** "toy" is the Classic set (its id predates the name). */
export type PieceSetId = "toy" | ExtraSetId;

export type PieceSetInfo = { id: PieceSetId; name: string; blurb: string; source: "chessschool" };

export const DEFAULT_PIECE_SET: PieceSetId = "toy";

export const PIECE_SETS: readonly PieceSetInfo[] = [
  { id: "toy", name: "Classic", blurb: "Chunky and friendly", source: "chessschool" },
  { id: "staunton", name: "Staunton", blurb: "Tournament shapes", source: "chessschool" },
  { id: "flat", name: "Modern", blurb: "Clean, flat and two-tone", source: "chessschool" },
  { id: "chaturanga", name: "Chaturanga", blurb: "Domes and arches from India", source: "chessschool" },
  { id: "geometric", name: "Bold", blurb: "Strong shapes, easy to spot", source: "chessschool" },
  { id: "bubble", name: "Bubble", blurb: "Round, soft and smiley", source: "chessschool" },
];
export const isPieceSet = (v: unknown): v is PieceSetId => PIECE_SETS.some((s) => s.id === v);

/**
 * Stored piece-set ids we no longer ship. Includes the Lichess upstream folder names
 * (pixel→arcade, chessnut, dubrovny, kiwen-suwi) in case an older save used those.
 * Clay, Pixel and Outline were retired in favour of the silhouette sets; a saved choice falls back to Classic.
 */
const REMOVED_PIECE_SETS = new Set(["spatial", "arcade", "bold", "heritage", "cartoon", "fantasy", "chessnut", "dubrovny", "kiwen-suwi", "clay", "pixel", "outline"]);

/** A saved preference for a removed set (or anything we don't ship) becomes Toy. */
export function migratePieceSet(v: unknown): PieceSetId {
  if (isPieceSet(v)) return v;
  return DEFAULT_PIECE_SET;
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

function extra(set: ExtraSetId, color: Color, type: PieceType): PieceDrawing {
  const art = EXTRA_SETS[set].art[type];
  const p = EXTRA_SETS[set].colors[color];
  const ops: PieceOp[] = [];
  for (const d of art.body) ops.push({ t: "path", d, fill: p.fill, stroke: p.stroke, sw: p.sw, lj: "round" });
  for (const d of art.shade ?? []) ops.push({ t: "path", d, fill: p.shade, stroke: p.stroke, sw: p.sw, lj: "round" });
  for (const d of art.detail ?? []) ops.push({ t: "path", d, fill: "none", stroke: p.detail, sw: p.dw, lc: "round", lj: "round" });
  for (const [cx, cy, r] of art.dots ?? []) ops.push({ t: "circle", cx, cy, r, fill: p.dot });
  return { viewBox: "0 0 100 100", ops };
}

const cache = new Map<string, PieceArtwork>();

/** Artwork for one piece in a set. Unknown sets fall back to Classic. */
export function pieceArtwork(set: PieceSetId, color: Color, type: PieceType): PieceArtwork {
  const key = `${set}${color}${type}`;
  let art = cache.get(key);
  if (!art) {
    art = { kind: "vector", drawing: set in EXTRA_SETS ? extra(set as ExtraSetId, color, type) : classic(color, type) };
    cache.set(key, art);
  }
  return art;
}
