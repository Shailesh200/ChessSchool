import type { CSSProperties } from "react";

/**
 * Original Staunton-style piece silhouettes (viewBox 0 0 45 45) rendered with a
 * vertical gradient, a soft ground shadow and a gloss highlight — giving 6
 * polished, premium piece sets (#3) without external art.
 */
const BASE =
  "M13 35h19c1.3 0 2.4 1 2.6 2.3l.3 2.2H10.1l.3-2.2C10.6 36 11.7 35 13 35z";

const SHAPES: Record<"k" | "q" | "r" | "b" | "n" | "p", string> = {
  p:
    "M22.5 8.5c2.4 0 4.3 1.9 4.3 4.3 0 1.4-.7 2.7-1.8 3.5 2.7 1.5 4.6 4.6 5.1 9.3.1 1.1-.8 2-1.8 2H17.7c-1.1 0-2-.9-1.8-2 .5-4.7 2.4-7.8 5.1-9.3-1.1-.8-1.8-2.1-1.8-3.5 0-2.4 1.9-4.3 4.3-4.3z" +
    BASE,
  r:
    "M12.6 11.5h3.5v2.9h3.3v-2.9h3.2v2.9h3.3v-2.9h3.5v7.7l-2.4 2.2H15l-2.4-2.2zM15.6 23.6h13.8l1.3 11.6H14.3z" +
    BASE,
  b:
    "M22.5 6.4c1.2 0 2.2 1 2.2 2.2 0 .7-.3 1.3-.8 1.7C26.7 12.5 29 16 29 20.4c0 4.9-3.4 8.2-6.5 8.2s-6.5-3.3-6.5-8.2c0-4.4 2.3-7.9 5.1-10.1-.5-.4-.8-1-.8-1.7 0-1.2 1-2.2 2.2-2.2zM19.3 18.7h6.4l-3.2 3.4z" +
    BASE,
  n:
    "M14.6 35c-.5-7.2 1.6-11.8 6.9-15.6l-3.4-1.4c-1 1.7-2.6 2.2-4.1.9-.8-.7-1-1.9-.5-2.8l3.4-6.4 1.3 3 2.4-2.9c1-1.2 2.5-1.9 4.1-1.9 5.6 0 10.1 4.6 10.1 10.2V35z" +
    "M18.5 13.2a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0z" +
    BASE,
  q:
    "M12.2 18.6l2.4 13.1h15.8l2.4-13.1-4.8 4.9-2.6-8.7-2.9 8.3-2.9-8.3-2.6 8.7z" +
    BASE,
  k:
    "M21.2 6.6h2.6v3h3v2.6h-3v2.8c4.7.9 8.1 5 8.1 10 0 .6-.1 1.3-.2 1.9L30 35H15l-1.7-8.1c-.1-.6-.2-1.3-.2-1.9 0-5 3.4-9.1 8.1-10v-2.8h-3V9.6h3z" +
    BASE,
};

// Crown balls for the queen (drawn over the gradient body).
const QUEEN_BALLS: [number, number][] = [
  [12.2, 18.6],
  [17, 14],
  [22.5, 12.4],
  [28, 14],
  [32.8, 18.6],
];

export interface PieceTheme {
  id: string;
  name: string;
  emoji: string;
  white: { fill: string; stroke: string };
  black: { fill: string; stroke: string };
}

export const PIECE_THEMES: PieceTheme[] = [
  { id: "classic", name: "Classic", emoji: "♟️", white: { fill: "#f4ecd8", stroke: "#3a2f20" }, black: { fill: "#3a3a3c", stroke: "#101012" } },
  { id: "forest", name: "Forest", emoji: "🌲", white: { fill: "#eaf2d4", stroke: "#3c5626" }, black: { fill: "#3f6130", stroke: "#1d2e14" } },
  { id: "ocean", name: "Ocean", emoji: "🌊", white: { fill: "#e2f3fb", stroke: "#205f82" }, black: { fill: "#1f7bab", stroke: "#0b3147" } },
  { id: "cute", name: "Cute", emoji: "🧸", white: { fill: "#ffe6f1", stroke: "#d76aa3" }, black: { fill: "#bf8cf2", stroke: "#6f33ad" } },
  { id: "sunset", name: "Sunset", emoji: "🌅", white: { fill: "#ffe7c4", stroke: "#bd5e26" }, black: { fill: "#e8693a", stroke: "#7e3417" } },
  { id: "neon", name: "Neon", emoji: "✨", white: { fill: "#eafff7", stroke: "#0ea371" }, black: { fill: "#13243a", stroke: "#26d6ef" } },
];

export function getPieceTheme(id: string): PieceTheme {
  return PIECE_THEMES.find((t) => t.id === id) ?? PIECE_THEMES[0]!;
}

/** Lighten (amt>0) or darken (amt<0) a #rrggbb colour. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amt > 0 ? c + (255 - c) * amt : c * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

type RenderFn = (props?: { svgStyle?: CSSProperties }) => React.JSX.Element;

function PieceSvg({
  type,
  pal,
  gid,
  svgStyle,
}: {
  type: keyof typeof SHAPES;
  pal: { fill: string; stroke: string };
  gid: string;
  svgStyle?: CSSProperties;
}) {
  const top = shade(pal.fill, 0.34);
  const bottom = shade(pal.fill, -0.2);
  return (
    <svg
      viewBox="0 0 45 45"
      width="100%"
      height="100%"
      style={{ ...svgStyle, filter: "drop-shadow(0 1.6px 1.1px rgba(0,0,0,0.32))" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="55%" stopColor={pal.fill} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* ground shadow */}
      <ellipse cx="22.5" cy="39.5" rx="12" ry="2.1" fill="rgba(0,0,0,0.14)" />
      {/* body */}
      <path
        d={SHAPES[type]}
        fill={`url(#${gid})`}
        stroke={pal.stroke}
        strokeWidth={1.15}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* queen crown balls */}
      {type === "q" &&
        QUEEN_BALLS.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2.4" fill={`url(#${gid})`} stroke={pal.stroke} strokeWidth={1.15} />
        ))}
      {/* king cross top */}
      {type === "k" && (
        <path d="M21.4 4h2.2v2h2v2.1h-2v2h-2.2v-2h-2V6h2z" fill={`url(#${gid})`} stroke={pal.stroke} strokeWidth={1.1} strokeLinejoin="round" />
      )}
      {/* bishop finial */}
      {type === "b" && <circle cx="22.5" cy="5.4" r="1.9" fill={`url(#${gid})`} stroke={pal.stroke} strokeWidth={1.1} />}
      {/* gloss highlight */}
      <ellipse cx="19" cy="15" rx="3.4" ry="6" fill={`url(#${gid}-g)`} opacity={0.55} transform="rotate(-12 19 15)" />
    </svg>
  );
}

/** Build a react-chessboard `pieces` map for the given theme id. */
export function buildPieces(themeId: string): Record<string, RenderFn> {
  const theme = getPieceTheme(themeId);
  const out: Record<string, RenderFn> = {};
  for (const color of ["w", "b"] as const) {
    const pal = color === "w" ? theme.white : theme.black;
    for (const P of ["K", "Q", "R", "B", "N", "P"] as const) {
      const type = P.toLowerCase() as keyof typeof SHAPES;
      const gid = `pc-${themeId}-${color}${P}`;
      out[`${color}${P}`] = ({ svgStyle } = {}) => (
        <PieceSvg type={type} pal={pal} gid={gid} svgStyle={svgStyle} />
      );
    }
  }
  return out;
}

/** A small swatch showing a few pieces in a theme — for the picker. */
export function PiecePreview({ themeId, size = 30 }: { themeId: string; size?: number }) {
  const theme = getPieceTheme(themeId);
  const one = (type: keyof typeof SHAPES, pal: { fill: string; stroke: string }, k: string) => (
    <div style={{ width: size, height: size }}>
      <PieceSvg type={type} pal={pal} gid={`prev-${themeId}-${k}`} />
    </div>
  );
  return (
    <div className="flex items-center justify-center">
      {one("k", theme.white, "k")}
      {one("q", theme.black, "q")}
      {one("n", theme.white, "n")}
    </div>
  );
}
