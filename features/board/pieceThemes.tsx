import type { CSSProperties } from "react";

/**
 * Original, minimal piece silhouettes (one path per type, viewBox 0 0 45 45)
 * recolored per theme — gives 5–6 distinct piece sets (#3) without external art.
 */
const SHAPES: Record<"k" | "q" | "r" | "b" | "n" | "p", string> = {
  p: "M22.5 10a5 5 0 0 1 4 8c2.2 1.8 3.5 4 3.8 7.2l.7 6.8h-17l.7-6.8c.3-3.2 1.6-5.4 3.8-7.2a5 5 0 0 1 4-8Z M13 33h19a2 2 0 0 1 2 2v3.5H11V35a2 2 0 0 1 2-2Z",
  r: "M13 12.5h3.4v3h3.4v-3h2.8v3h3.4v-3h3.6v9l-2.5 2.5v8.5l3 3h-21l3-3v-8.5l-2.5-2.5Z M11.5 35.5h22v3.5h-22Z",
  b: "M22.5 8a2.5 2.5 0 0 1 1.5 4.5c2.6 2.2 4.7 5.4 4.7 9.7 0 4.6-3.4 7.6-7.7 7.6s-7.7-3-7.7-7.6c0-4.3 2.1-7.5 4.7-9.7A2.5 2.5 0 0 1 22.5 8Z M13 33.5h19a2 2 0 0 1 2 2v3.5H11V35.5a2 2 0 0 1 2-2Z",
  n: "M30.5 35.5h-18c0-7.5 2.2-11.5 7.3-15.5l-3.3-1c-1.6 1.8-3.4 2-4.8.3l4-5.3 1.2 2.2 3.1-4.2c3.2-3.2 7.4-3.2 11 .4 3.8 4 4.7 9.4 4.7 16.4Z M11.5 35.5h22v3.5h-22Z",
  q: "M10.5 17l2.6 18h18.8l2.6-18-6.2 6.3-2.7-9.3-3.1 9.3-3.1-9.3-2.7 9.3Z M12.5 35.5h20v3.5h-20Z",
  k: "M21 7.5h3v3.2h3.2v3h-3.2v3.1c4.2 1 7.2 4.6 7.2 9.3l-2.6 8.4h-15.2l-2.6-8.4c0-4.7 3-8.3 7.2-9.3v-3.1h-3.2v-3h3.2Z M12.5 35.5h20v3.5h-20Z",
};

export interface PieceTheme {
  id: string;
  name: string;
  emoji: string;
  white: { fill: string; stroke: string };
  black: { fill: string; stroke: string };
}

export const PIECE_THEMES: PieceTheme[] = [
  { id: "classic", name: "Classic", emoji: "♟️", white: { fill: "#f7f3e8", stroke: "#352c1f" }, black: { fill: "#2c2c2c", stroke: "#000000" } },
  { id: "forest", name: "Forest", emoji: "🌲", white: { fill: "#eaf3d6", stroke: "#3f5a2a" }, black: { fill: "#3f5a2a", stroke: "#21331a" } },
  { id: "ocean", name: "Ocean", emoji: "🌊", white: { fill: "#e0f2fb", stroke: "#1f5d80" }, black: { fill: "#1f74a0", stroke: "#0c3b55" } },
  { id: "cute", name: "Cute", emoji: "🧸", white: { fill: "#ffe3ef", stroke: "#d36aa0" }, black: { fill: "#c08bf0", stroke: "#7b3fb5" } },
  { id: "sunset", name: "Sunset", emoji: "🌅", white: { fill: "#ffe9cc", stroke: "#bf612a" }, black: { fill: "#e2683a", stroke: "#8f3d1c" } },
  { id: "neon", name: "Neon", emoji: "✨", white: { fill: "#eafff6", stroke: "#10b981" }, black: { fill: "#10243a", stroke: "#22d3ee" } },
];

export function getPieceTheme(id: string): PieceTheme {
  return PIECE_THEMES.find((t) => t.id === id) ?? PIECE_THEMES[0]!;
}

/** A small swatch showing a few pieces in a theme — for the picker. */
export function PiecePreview({ themeId, size = 26 }: { themeId: string; size?: number }) {
  const theme = getPieceTheme(themeId);
  const glyph = (type: keyof typeof SHAPES, pal: { fill: string; stroke: string }) => (
    <svg viewBox="0 0 45 45" width={size} height={size} aria-hidden>
      <path d={SHAPES[type]} fill={pal.fill} stroke={pal.stroke} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
  return (
    <div className="flex items-center justify-center">
      {glyph("k", theme.white)}
      {glyph("q", theme.black)}
      {glyph("n", theme.white)}
    </div>
  );
}

type RenderFn = (props?: { svgStyle?: CSSProperties }) => React.JSX.Element;

/** Build a react-chessboard `pieces` map for the given theme id. */
export function buildPieces(themeId: string): Record<string, RenderFn> {
  const theme = getPieceTheme(themeId);
  const out: Record<string, RenderFn> = {};
  for (const color of ["w", "b"] as const) {
    const pal = color === "w" ? theme.white : theme.black;
    for (const P of ["K", "Q", "R", "B", "N", "P"] as const) {
      const type = P.toLowerCase() as keyof typeof SHAPES;
      out[`${color}${P}`] = ({ svgStyle } = {}) => (
        <svg viewBox="0 0 45 45" width="100%" height="100%" style={svgStyle}>
          <path
            d={SHAPES[type]}
            fill={pal.fill}
            stroke={pal.stroke}
            strokeWidth={1.4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      );
    }
  }
  return out;
}
