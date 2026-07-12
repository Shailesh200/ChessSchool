/**
 * Piece sets — matched to apps/web/features/board/pieceThemes.tsx.
 * Asset sets are bundled offline via pieceSvgContent.ts (generated from web/public/pieces).
 */

const BASE = "M13 35h19c1.3 0 2.4 1 2.6 2.3l.3 2.2H10.1l.3-2.2C10.6 36 11.7 35 13 35z";

export type PieceType = "k" | "q" | "r" | "b" | "n" | "p";

export type AssetSet =
  | "cburnett"
  | "merida"
  | "alpha"
  | "spatial"
  | "pixel"
  | "dubrovny"
  | "chessnut"
  | "fantasy"
  | "kiwen-suwi"
  | "fairytale"
  | "anime";

export type PieceThemeId =
  | "classic"
  | "merida"
  | "alpha"
  | "marble"
  | "crystal"
  | "neon"
  | "forest"
  | "ocean"
  | "cartoon"
  | "fairytale"
  | "anime"
  | "fantasy";

export interface PieceThemeDef {
  id: PieceThemeId;
  name: string;
  family: string;
  emoji: string;
  shapeSet: AssetSet | "staunton";
  style: "asset" | "sculpted";
  filter?: string;
  white: { fill: string; stroke: string };
  black: { fill: string; stroke: string };
}

export const PIECE_THEMES: PieceThemeDef[] = [
  { id: "classic", name: "Classic", family: "Cburnett", emoji: "♟️", shapeSet: "cburnett", style: "asset", white: { fill: "#f4ecd8", stroke: "#3a2f20" }, black: { fill: "#3a3a3c", stroke: "#101012" } },
  { id: "merida", name: "Merida", family: "Merida", emoji: "🏰", shapeSet: "merida", style: "asset", white: { fill: "#f4ecd8", stroke: "#3a2f20" }, black: { fill: "#1f1a17", stroke: "#101012" } },
  { id: "alpha", name: "Alpha", family: "Alpha", emoji: "◇", shapeSet: "alpha", style: "asset", white: { fill: "#f9f9f9", stroke: "#101010" }, black: { fill: "#101010", stroke: "#f9f9f9" } },
  { id: "marble", name: "Marble 3D", family: "Sculpted", emoji: "🏛️", shapeSet: "staunton", style: "sculpted", white: { fill: "#f1ece1", stroke: "#9a8f78" }, black: { fill: "#34373d", stroke: "#15171b" } },
  { id: "crystal", name: "Spatial", family: "Isometric", emoji: "💎", shapeSet: "spatial", style: "asset", white: { fill: "#f8fbff", stroke: "#4a7ab5" }, black: { fill: "#2a4f7a", stroke: "#0f1f33" } },
  { id: "neon", name: "Arcade", family: "Pixel", emoji: "✨", shapeSet: "pixel", style: "asset", filter: "neon", white: { fill: "#0a1628", stroke: "#5dffb8" }, black: { fill: "#0a1628", stroke: "#5ec8ff" } },
  { id: "forest", name: "Heritage", family: "Dubrovny", emoji: "🌲", shapeSet: "dubrovny", style: "asset", white: { fill: "#f0dcc0", stroke: "#8b5e34" }, black: { fill: "#4a3220", stroke: "#1a1008" } },
  { id: "ocean", name: "Bold", family: "Chessnut", emoji: "🌊", shapeSet: "chessnut", style: "asset", white: { fill: "#eef2f6", stroke: "#64748b" }, black: { fill: "#334155", stroke: "#0f172a" } },
  { id: "cartoon", name: "Cartoon", family: "Kiwen Suwi", emoji: "🎨", shapeSet: "kiwen-suwi", style: "asset", white: { fill: "#fff8f0", stroke: "#b45309" }, black: { fill: "#292524", stroke: "#0c0a09" } },
  { id: "fairytale", name: "Fairytale", family: "Storybook", emoji: "🏰", shapeSet: "fairytale", style: "asset", white: { fill: "#FAF5E8", stroke: "#333333" }, black: { fill: "#5A5A66", stroke: "#333333" } },
  { id: "anime", name: "Anime", family: "Shonen", emoji: "🎌", shapeSet: "anime", style: "asset", white: { fill: "#fde0c8", stroke: "#1a0f28" }, black: { fill: "#1e4a7a", stroke: "#f8fafc" } },
  { id: "fantasy", name: "Fantasy", family: "Ornate", emoji: "🎴", shapeSet: "fantasy", style: "asset", white: { fill: "#fff8f0", stroke: "#b45309" }, black: { fill: "#292524", stroke: "#0c0a09" } },
];

export const SHAPES: Record<PieceType, string> = {
  p: "M22.5 8.5c2.4 0 4.3 1.9 4.3 4.3 0 1.4-.7 2.7-1.8 3.5 2.7 1.5 4.6 4.6 5.1 9.3.1 1.1-.8 2-1.8 2H17.7c-1.1 0-2-.9-1.8-2 .5-4.7 2.4-7.8 5.1-9.3-1.1-.8-1.8-2.1-1.8-3.5 0-2.4 1.9-4.3 4.3-4.3z" + BASE,
  r: "M12.6 11.5h3.5v2.9h3.3v-2.9h3.2v2.9h3.3v-2.9h3.5v7.7l-2.4 2.2H15l-2.4-2.2zM15.6 23.6h13.8l1.3 11.6H14.3z" + BASE,
  b: "M22.5 6.4c1.2 0 2.2 1 2.2 2.2 0 .7-.3 1.3-.8 1.7C26.7 12.5 29 16 29 20.4c0 4.9-3.4 8.2-6.5 8.2s-6.5-3.3-6.5-8.2c0-4.4 2.3-7.9 5.1-10.1-.5-.4-.8-1-.8-1.7 0-1.2 1-2.2 2.2-2.2zM19.3 18.7h6.4l-3.2 3.4z" + BASE,
  n: "M14.6 35c-.5-7.2 1.6-11.8 6.9-15.6l-3.4-1.4c-1 1.7-2.6 2.2-4.1.9-.8-.7-1-1.9-.5-2.8l3.4-6.4 1.3 3 2.4-2.9c1-1.2 2.5-1.9 4.1-1.9 5.6 0 10.1 4.6 10.1 10.2V35z" + "M18.5 13.2a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0z" + BASE,
  q: "M12.2 18.6l2.4 13.1h15.8l2.4-13.1-4.8 4.9-2.6-8.7-2.9 8.3-2.9-8.3-2.6 8.7z" + BASE,
  k: "M21.2 6.6h2.6v3h3v2.6h-3v2.8c4.7.9 8.1 5 8.1 10 0 .6-.1 1.3-.2 1.9L30 35H15l-1.7-8.1c-.1-.6-.2-1.3-.2-1.9 0-5 3.4-9.1 8.1-10v-2.8h-3V9.6h3z" + BASE,
};

export const QUEEN_BALLS: [number, number][] = [
  [12.2, 18.6],
  [17, 14],
  [22.5, 12.4],
  [28, 14],
  [32.8, 18.6],
];

const VALID = new Set<string>(PIECE_THEMES.map((t) => t.id));

/** Normalize legacy / cross-surface ids to a valid web piece theme. */
export function normalizePieceThemeId(id: string | undefined): PieceThemeId {
  if (!id) return "classic";
  if (id === "blossom" || id === "cute") return "cartoon";
  if (id === "barbie" || id === "princess") return "fairytale";
  if (VALID.has(id)) return id as PieceThemeId;
  return "classic";
}

export function getPieceTheme(id: string): PieceThemeDef {
  return PIECE_THEMES.find((t) => t.id === normalizePieceThemeId(id)) ?? PIECE_THEMES[0]!;
}
