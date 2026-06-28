import type { CSSProperties } from "react";
import { defaultPieces } from "react-chessboard";

/**
 * Piece themes (#3) — each a genuinely different DESIGN, not a recolor:
 *  - classic : react-chessboard's default Staunton set (the original)
 *  - crystal : 3D-shaded Staunton silhouettes (gradient + gloss + shadow)
 *  - neon    : glowing outline-only pieces
 *  - forest / ocean / cute : emoji sets on a side-coloured disc
 */
const BASE =
  "M13 35h19c1.3 0 2.4 1 2.6 2.3l.3 2.2H10.1l.3-2.2C10.6 36 11.7 35 13 35z";

type PieceType = "k" | "q" | "r" | "b" | "n" | "p";

const SHAPES: Record<PieceType, string> = {
  p: "M22.5 8.5c2.4 0 4.3 1.9 4.3 4.3 0 1.4-.7 2.7-1.8 3.5 2.7 1.5 4.6 4.6 5.1 9.3.1 1.1-.8 2-1.8 2H17.7c-1.1 0-2-.9-1.8-2 .5-4.7 2.4-7.8 5.1-9.3-1.1-.8-1.8-2.1-1.8-3.5 0-2.4 1.9-4.3 4.3-4.3z" + BASE,
  r: "M12.6 11.5h3.5v2.9h3.3v-2.9h3.2v2.9h3.3v-2.9h3.5v7.7l-2.4 2.2H15l-2.4-2.2zM15.6 23.6h13.8l1.3 11.6H14.3z" + BASE,
  b: "M22.5 6.4c1.2 0 2.2 1 2.2 2.2 0 .7-.3 1.3-.8 1.7C26.7 12.5 29 16 29 20.4c0 4.9-3.4 8.2-6.5 8.2s-6.5-3.3-6.5-8.2c0-4.4 2.3-7.9 5.1-10.1-.5-.4-.8-1-.8-1.7 0-1.2 1-2.2 2.2-2.2zM19.3 18.7h6.4l-3.2 3.4z" + BASE,
  n: "M14.6 35c-.5-7.2 1.6-11.8 6.9-15.6l-3.4-1.4c-1 1.7-2.6 2.2-4.1.9-.8-.7-1-1.9-.5-2.8l3.4-6.4 1.3 3 2.4-2.9c1-1.2 2.5-1.9 4.1-1.9 5.6 0 10.1 4.6 10.1 10.2V35z" + "M18.5 13.2a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0z" + BASE,
  q: "M12.2 18.6l2.4 13.1h15.8l2.4-13.1-4.8 4.9-2.6-8.7-2.9 8.3-2.9-8.3-2.6 8.7z" + BASE,
  k: "M21.2 6.6h2.6v3h3v2.6h-3v2.8c4.7.9 8.1 5 8.1 10 0 .6-.1 1.3-.2 1.9L30 35H15l-1.7-8.1c-.1-.6-.2-1.3-.2-1.9 0-5 3.4-9.1 8.1-10v-2.8h-3V9.6h3z" + BASE,
};

const QUEEN_BALLS: [number, number][] = [[12.2, 18.6], [17, 14], [22.5, 12.4], [28, 14], [32.8, 18.6]];

export interface PieceTheme {
  id: string;
  name: string;
  emoji: string;
  style: "default" | "crystal" | "neon" | "emoji";
  white: { fill: string; stroke: string };
  black: { fill: string; stroke: string };
  glyphs?: Record<PieceType, string>;
}

export const PIECE_THEMES: PieceTheme[] = [
  { id: "classic", name: "Classic", emoji: "♟️", style: "default", white: { fill: "#f4ecd8", stroke: "#3a2f20" }, black: { fill: "#3a3a3c", stroke: "#101012" } },
  { id: "crystal", name: "3D Crystal", emoji: "💎", style: "crystal", white: { fill: "#eef2f8", stroke: "#3a4a64" }, black: { fill: "#465a78", stroke: "#1b2435" } },
  { id: "neon", name: "Neon", emoji: "✨", style: "neon", white: { fill: "#0c1622", stroke: "#39e6b0" }, black: { fill: "#0c1622", stroke: "#3ad6ff" } },
  { id: "forest", name: "Forest", emoji: "🌲", style: "emoji", white: { fill: "#eaf4d6", stroke: "#4c6b2e" }, black: { fill: "#3f6130", stroke: "#21331a" }, glyphs: { p: "🌰", n: "🦌", b: "🦉", r: "🌲", q: "🦋", k: "🐻" } },
  { id: "ocean", name: "Ocean", emoji: "🌊", style: "emoji", white: { fill: "#e0f2fb", stroke: "#1f6f9a" }, black: { fill: "#1f6f9a", stroke: "#0b3147" }, glyphs: { p: "🐚", n: "🦐", b: "🐠", r: "🪸", q: "🐙", k: "🦈" } },
  { id: "cute", name: "Cute", emoji: "🧸", style: "emoji", white: { fill: "#ffe6f1", stroke: "#d76aa3" }, black: { fill: "#c79bf5", stroke: "#7b45bd" }, glyphs: { p: "🐥", n: "🐴", b: "🐰", r: "🐘", q: "🦄", k: "🦁" } },
];

export function getPieceTheme(id: string): PieceTheme {
  return PIECE_THEMES.find((t) => t.id === id) ?? PIECE_THEMES[0]!;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amt > 0 ? c + (255 - c) * amt : c * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

type RenderFn = (props?: { svgStyle?: CSSProperties }) => React.JSX.Element;
type Pal = { fill: string; stroke: string };

/** Silhouette piece — 3D "crystal" (gradient) or "neon" (outline). */
function SilhouettePiece({ type, pal, gid, neon, svgStyle }: { type: PieceType; pal: Pal; gid: string; neon: boolean; svgStyle?: CSSProperties }) {
  const fill = neon ? "none" : `url(#${gid})`;
  const sw = neon ? 2.6 : 1.15;
  const filter = neon ? `drop-shadow(0 0 2.5px ${pal.stroke}) drop-shadow(0 0 1px ${pal.stroke})` : "drop-shadow(0 1.6px 1.1px rgba(0,0,0,0.32))";
  return (
    <svg viewBox="0 0 45 45" width="100%" height="100%" style={{ ...svgStyle, filter }}>
      {!neon && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={shade(pal.fill, 0.38)} />
            <stop offset="55%" stopColor={pal.fill} />
            <stop offset="100%" stopColor={shade(pal.fill, -0.24)} />
          </linearGradient>
          <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
      )}
      {!neon && <ellipse cx="22.5" cy="39.5" rx="12" ry="2.1" fill="rgba(0,0,0,0.14)" />}
      <path d={SHAPES[type]} fill={fill} stroke={pal.stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
      {type === "q" && QUEEN_BALLS.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="2.4" fill={fill} stroke={pal.stroke} strokeWidth={sw} />)}
      {type === "k" && <path d="M21.4 4h2.2v2h2v2.1h-2v2h-2.2v-2h-2V6h2z" fill={fill} stroke={pal.stroke} strokeWidth={Math.min(sw, 1.6)} strokeLinejoin="round" />}
      {type === "b" && <circle cx="22.5" cy="5.4" r="1.9" fill={fill} stroke={pal.stroke} strokeWidth={Math.min(sw, 1.6)} />}
      {!neon && <ellipse cx="19" cy="15" rx="3.4" ry="6" fill={`url(#${gid}-g)`} opacity={0.55} transform="rotate(-12 19 15)" />}
    </svg>
  );
}

/** Emoji piece on a side-coloured disc (light disc = white, dark disc = black). */
function EmojiPiece({ glyph, pal, svgStyle }: { glyph: string; pal: Pal; svgStyle?: CSSProperties }) {
  return (
    <svg viewBox="0 0 45 45" width="100%" height="100%" style={{ ...svgStyle, filter: "drop-shadow(0 1.5px 1px rgba(0,0,0,0.3))" }}>
      <circle cx="22.5" cy="22.5" r="18.5" fill={pal.fill} stroke={pal.stroke} strokeWidth="1.8" />
      <text x="22.5" y="24" fontSize="22" textAnchor="middle" dominantBaseline="central">{glyph}</text>
    </svg>
  );
}

function renderPiece(theme: PieceTheme, type: PieceType, color: "w" | "b", gid: string, svgStyle?: CSSProperties) {
  const pal = color === "w" ? theme.white : theme.black;
  if (theme.style === "emoji" && theme.glyphs) return <EmojiPiece glyph={theme.glyphs[type]} pal={pal} svgStyle={svgStyle} />;
  return <SilhouettePiece type={type} pal={pal} gid={gid} neon={theme.style === "neon"} svgStyle={svgStyle} />;
}

/** Build a react-chessboard `pieces` map for the given theme id. */
export function buildPieces(themeId: string): Record<string, RenderFn> {
  const theme = getPieceTheme(themeId);
  const out: Record<string, RenderFn> = {};
  for (const color of ["w", "b"] as const) {
    for (const P of ["K", "Q", "R", "B", "N", "P"] as const) {
      const type = P.toLowerCase() as PieceType;
      const gid = `pc-${themeId}-${color}${P}`;
      out[`${color}${P}`] = ({ svgStyle } = {}) => renderPiece(theme, type, color, gid, svgStyle);
    }
  }
  return out;
}

/** A small swatch for the picker. */
export function PiecePreview({ themeId, size = 30 }: { themeId: string; size?: number }) {
  const theme = getPieceTheme(themeId);
  if (theme.style === "default") {
    const d = (code: string, k: string) => <div key={k} style={{ width: size, height: size }}>{defaultPieces[code]?.()}</div>;
    return <div className="flex items-center justify-center">{d("wK", "k")}{d("bQ", "q")}{d("wN", "n")}</div>;
  }
  const one = (type: PieceType, color: "w" | "b", k: string) => (
    <div key={k} style={{ width: size, height: size }}>{renderPiece(theme, type, color, `prev-${themeId}-${k}`)}</div>
  );
  return <div className="flex items-center justify-center">{one("k", "w", "k")}{one("q", "b", "q")}{one("n", "w", "n")}</div>;
}
