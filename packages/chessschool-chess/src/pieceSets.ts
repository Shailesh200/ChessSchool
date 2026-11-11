import type { Color, PieceType } from "./board";
import { PIXEL_SET } from "./pieceSets.pixel";
import { PIECE_ART, PIECE_STROKE } from "./pieces";

/** One drawing format for every set, so web (<svg>) and native (react-native-svg) share a renderer. */
export type PieceOp =
  | { t: "path"; d: string; fill?: string; stroke?: string; sw?: number; lj?: string; lc?: string; fo?: number; fr?: string }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: string; stroke?: string; sw?: number };
export type PieceDrawing = { viewBox: string; ops: PieceOp[]; pixelated?: boolean };
/** Retained sets are drawn from files: `<set>/<code>` under assets/pieces (.svg on web, .png on native). */
export type PieceArtwork = { kind: "vector"; drawing: PieceDrawing } | { kind: "asset"; asset: string; pixelated?: boolean };

export type PieceSetId = "toy" | "clay" | "pixel" | "outline" | "spatial" | "arcade" | "bold" | "heritage" | "cartoon" | "fantasy";

export type PieceSetInfo = { id: PieceSetId; name: string; blurb: string; source: "chessschool" | "lichess"; credit?: string };

export const PIECE_SETS: readonly PieceSetInfo[] = [
  { id: "toy", name: "Toy", blurb: "Chunky and friendly", source: "chessschool" },
  { id: "clay", name: "Clay", blurb: "Soft, hand-made feel", source: "chessschool" },
  { id: "pixel", name: "Pixel", blurb: "Retro game sprites", source: "chessschool" },
  { id: "outline", name: "Outline", blurb: "High contrast, easiest to read", source: "chessschool" },
  { id: "spatial", name: "Spatial", blurb: "Faceted 3D", source: "lichess" },
  { id: "arcade", name: "Arcade", blurb: "Bright pixel art", source: "lichess" },
  { id: "bold", name: "Bold", blurb: "Thick modern outlines", source: "lichess" },
  { id: "heritage", name: "Heritage", blurb: "Carved classic", source: "lichess" },
  { id: "cartoon", name: "Cartoon", blurb: "Soft and rounded", source: "lichess" },
  { id: "fantasy", name: "Fantasy", blurb: "Ornate storybook", source: "lichess" },
];
export const isPieceSet = (v: unknown): v is PieceSetId => PIECE_SETS.some((s) => s.id === v);

type Palette = { fill: string; stroke: string; detail: string; dot: string; sw: number; shadow?: string };
const STYLES: Record<"toy" | "clay" | "outline", Record<Color, Palette>> = {
  toy: {
    w: { fill: "#FFF7E8", stroke: "#2A2547", detail: "#B9B3D9", dot: "#2A2547", sw: PIECE_STROKE },
    b: { fill: "#3B3770", stroke: "#15132B", detail: "#7E79D6", dot: "#FFF7E8", sw: PIECE_STROKE },
  },
  // Matte clay: same-hue outline, soft highlight and a contact shadow instead of ink lines.
  clay: {
    w: { fill: "#F3E4C8", stroke: "#B99A6B", detail: "#FFF6E4", dot: "#5A4630", sw: 3, shadow: "rgba(90, 60, 30, 0.22)" },
    b: { fill: "#5653CC", stroke: "#34318F", detail: "#7A77EC", dot: "#FFF6E4", sw: 3, shadow: "rgba(20, 18, 60, 0.3)" },
  },
  outline: {
    w: { fill: "#FFFFFF", stroke: "#000000", detail: "#000000", dot: "#000000", sw: 7 },
    b: { fill: "#000000", stroke: "#000000", detail: "#FFFFFF", dot: "#FFFFFF", sw: 7 },
  },
};

function vector(style: keyof typeof STYLES, color: Color, type: PieceType): PieceDrawing {
  const art = PIECE_ART[type];
  const p = STYLES[style][color];
  const ops: PieceOp[] = [];
  if (p.shadow) ops.push({ t: "ellipse", cx: 50, cy: 92, rx: 30, ry: 4, fill: p.shadow });
  for (const d of art.body) ops.push({ t: "path", d, fill: p.fill, stroke: p.stroke, sw: p.sw, lj: "round" });
  if (style === "clay") ops.push({ t: "ellipse", cx: 42, cy: 40, rx: 5, ry: 12, fill: "rgba(255,255,255,0.28)" });
  for (const d of art.detail) ops.push({ t: "path", d, fill: "none", stroke: p.detail, sw: style === "outline" ? 4.5 : 3.5, lc: "round" });
  for (const [cx, cy, r] of art.dots ?? []) ops.push({ t: "circle", cx, cy, r, fill: p.dot });
  return { viewBox: "0 0 100 100", ops };
}

/** Artwork for one piece in a set. Unknown sets fall back to Toy. */
export function pieceArtwork(set: PieceSetId, color: Color, type: PieceType): PieceArtwork {
  const code = `${color}${type.toUpperCase()}`;
  if (set === "clay" || set === "outline") return { kind: "vector", drawing: vector(set, color, type) };
  if (set === "pixel") return { kind: "vector", drawing: { ...PIXEL_SET[code], pixelated: true } };
  if (PIECE_SETS.some((s) => s.id === set && s.source === "lichess")) return { kind: "asset", asset: `${set}/${code}`, pixelated: set === "arcade" };
  return { kind: "vector", drawing: vector("toy", color, type) };
}
