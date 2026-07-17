import { memo, type CSSProperties } from "react";

/**
 * Piece sets — every theme uses a distinct silhouette family.
 * Asset sets: Lichess SVGs in `public/pieces/{set}/`.
 * Marble 3D: our custom sculpted Staunton with marble shading.
 */
const BASE = "M13 35h19c1.3 0 2.4 1 2.6 2.3l.3 2.2H10.1l.3-2.2C10.6 36 11.7 35 13 35z";

type PieceType = "k" | "q" | "r" | "b" | "n" | "p";

/** Bundled Lichess piece shape libraries — each is a visibly different design. */
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

const SHAPES: Record<PieceType, string> = {
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
    "M12.2 18.6l2.4 13.1h15.8l2.4-13.1-4.8 4.9-2.6-8.7-2.9 8.3-2.9-8.3-2.6 8.7z" + BASE,
  k:
    "M21.2 6.6h2.6v3h3v2.6h-3v2.8c4.7.9 8.1 5 8.1 10 0 .6-.1 1.3-.2 1.9L30 35H15l-1.7-8.1c-.1-.6-.2-1.3-.2-1.9 0-5 3.4-9.1 8.1-10v-2.8h-3V9.6h3z" +
    BASE,
};

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
  /** Shape family label shown in Theme Studio. */
  family: string;
  emoji: string;
  shapeSet: AssetSet | "staunton";
  style: "asset" | "sculpted";
  /** Optional CSS filter on asset pieces (e.g. neon glow on pixel set). */
  filter?: string;
  white: { fill: string; stroke: string };
  black: { fill: string; stroke: string };
}

export const PIECE_THEMES: PieceTheme[] = [
  {
    id: "classic",
    name: "Classic",
    family: "Cburnett",
    emoji: "♟️",
    shapeSet: "cburnett",
    style: "asset",
    white: { fill: "#f4ecd8", stroke: "#3a2f20" },
    black: { fill: "#3a3a3c", stroke: "#101012" },
  },
  {
    id: "merida",
    name: "Merida",
    family: "Merida",
    emoji: "🏰",
    shapeSet: "merida",
    style: "asset",
    white: { fill: "#f4ecd8", stroke: "#3a2f20" },
    black: { fill: "#1f1a17", stroke: "#101012" },
  },
  {
    id: "alpha",
    name: "Alpha",
    family: "Alpha",
    emoji: "◇",
    shapeSet: "alpha",
    style: "asset",
    white: { fill: "#f9f9f9", stroke: "#101010" },
    black: { fill: "#101010", stroke: "#f9f9f9" },
  },
  {
    id: "marble",
    name: "Marble 3D",
    family: "Sculpted",
    emoji: "🏛️",
    shapeSet: "staunton",
    style: "sculpted",
    white: { fill: "#f1ece1", stroke: "#9a8f78" },
    black: { fill: "#34373d", stroke: "#15171b" },
  },
  {
    id: "crystal",
    name: "Spatial",
    family: "Isometric",
    emoji: "💎",
    shapeSet: "spatial",
    style: "asset",
    white: { fill: "#f8fbff", stroke: "#4a7ab5" },
    black: { fill: "#2a4f7a", stroke: "#0f1f33" },
  },
  {
    id: "neon",
    name: "Arcade",
    family: "Pixel",
    emoji: "✨",
    shapeSet: "pixel",
    style: "asset",
    filter: "drop-shadow(0 0 2px #5dffb8) drop-shadow(0 0 5px #5ec8ff) saturate(1.35)",
    white: { fill: "#0a1628", stroke: "#5dffb8" },
    black: { fill: "#0a1628", stroke: "#5ec8ff" },
  },
  {
    id: "forest",
    name: "Heritage",
    family: "Dubrovny",
    emoji: "🌲",
    shapeSet: "dubrovny",
    style: "asset",
    white: { fill: "#f0dcc0", stroke: "#8b5e34" },
    black: { fill: "#4a3220", stroke: "#1a1008" },
  },
  {
    id: "ocean",
    name: "Bold",
    family: "Chessnut",
    emoji: "🌊",
    shapeSet: "chessnut",
    style: "asset",
    white: { fill: "#eef2f6", stroke: "#64748b" },
    black: { fill: "#334155", stroke: "#0f172a" },
  },
  {
    id: "cartoon",
    name: "Cartoon",
    family: "Kiwen Suwi",
    emoji: "🎨",
    shapeSet: "kiwen-suwi",
    style: "asset",
    white: { fill: "#fff8f0", stroke: "#b45309" },
    black: { fill: "#292524", stroke: "#0c0a09" },
  },
  {
    id: "fairytale",
    name: "Fairytale",
    family: "Storybook",
    emoji: "🏰",
    shapeSet: "fairytale",
    style: "asset",
    white: { fill: "#FAF5E8", stroke: "#333333" },
    black: { fill: "#5A5A66", stroke: "#333333" },
  },
  {
    id: "anime",
    name: "Anime",
    family: "Shonen",
    emoji: "🎌",
    shapeSet: "anime",
    style: "asset",
    white: { fill: "#fde0c8", stroke: "#1a0f28" },
    black: { fill: "#1e4a7a", stroke: "#f8fafc" },
  },
  {
    id: "fantasy",
    name: "Fantasy",
    family: "Ornate",
    emoji: "🎴",
    shapeSet: "fantasy",
    style: "asset",
    white: { fill: "#fff8f0", stroke: "#b45309" },
    black: { fill: "#292524", stroke: "#0c0a09" },
  },
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

/** Module cache — stable component identities across ChessBoard remounts. */
const piecesCache = new Map<string, Record<string, RenderFn>>();

const AssetPiece = memo(function AssetPiece({
  set,
  code,
  filter,
  svgStyle,
}: {
  set: AssetSet;
  code: string;
  filter?: string;
  svgStyle?: CSSProperties;
}) {
  return (
    // Filter lives on an inner layer so parent transform slides stay glitch-free.
    <span
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        filter,
        ...svgStyle,
        // Promote a clean GPU layer; keep filter off the transforming ancestor.
        transform: "translateZ(0)",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- bundled SVG assets */}
      <img
        src={`/pieces/${set}/${code}.svg`}
        alt=""
        draggable={false}
        decoding="async"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    </span>
  );
});

/** Custom 3D-shaded Staunton — only used by Marble 3D. */
const MarblePiece = memo(function MarblePiece({
  type,
  pal,
  gid,
  svgStyle,
}: {
  type: PieceType;
  pal: Pal;
  gid: string;
  svgStyle?: CSSProperties;
}) {
  const fill = `url(#${gid})`;
  return (
    <svg
      viewBox="0 0 45 45"
      width="100%"
      height="100%"
      style={{
        ...svgStyle,
        filter: "drop-shadow(0 1.7px 1.1px rgba(0,0,0,0.34))",
        transform: "translateZ(0)",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor={shade(pal.fill, 0.34)} />
          <stop offset="50%" stopColor={pal.fill} />
          <stop offset="100%" stopColor={shade(pal.fill, -0.22)} />
        </linearGradient>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <ellipse cx="22.5" cy="39.6" rx="12" ry="2.1" fill="rgba(0,0,0,0.16)" />
      <path
        d={SHAPES[type]}
        fill={fill}
        stroke={pal.stroke}
        strokeWidth={1.1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {type === "q" &&
        QUEEN_BALLS.map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="2.4"
            fill={fill}
            stroke={pal.stroke}
            strokeWidth={1.1}
          />
        ))}
      {type === "k" && (
        <path
          d="M21.4 4h2.2v2h2v2.1h-2v2h-2.2v-2h-2V6h2z"
          fill={fill}
          stroke={pal.stroke}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      )}
      {type === "b" && (
        <circle
          cx="22.5"
          cy="5.4"
          r="1.9"
          fill={fill}
          stroke={pal.stroke}
          strokeWidth={1.6}
        />
      )}
      <ellipse
        cx="19"
        cy="15"
        rx="3.4"
        ry="6.4"
        fill={`url(#${gid}-g)`}
        opacity={0.7}
        transform="rotate(-12 19 15)"
      />
    </svg>
  );
});

function renderMarble(
  theme: PieceTheme,
  type: PieceType,
  color: "w" | "b",
  gid: string,
  svgStyle?: CSSProperties,
) {
  const pal = color === "w" ? theme.white : theme.black;
  return <MarblePiece type={type} pal={pal} gid={gid} svgStyle={svgStyle} />;
}

/** Build a react-chessboard `pieces` map for the given theme id. */
export function buildPieces(themeId: string): Record<string, RenderFn> {
  const cached = piecesCache.get(themeId);
  if (cached) return cached;

  const theme = getPieceTheme(themeId);
  const out: Record<string, RenderFn> = {};
  for (const color of ["w", "b"] as const) {
    for (const P of ["K", "Q", "R", "B", "N", "P"] as const) {
      const code = `${color}${P}`;
      const type = P.toLowerCase() as PieceType;
      const gid = `pc-${themeId}-${code}`;
      if (theme.style === "asset") {
        out[code] = ({ svgStyle } = {}) => (
          <AssetPiece
            set={theme.shapeSet as AssetSet}
            code={code}
            filter={theme.filter}
            svgStyle={svgStyle}
          />
        );
      } else {
        out[code] = ({ svgStyle } = {}) =>
          renderMarble(theme, type, color, gid, svgStyle);
      }
    }
  }
  piecesCache.set(themeId, out);
  return out;
}

/** A small swatch for the picker. */
export function PiecePreview({
  themeId,
  size = 30,
}: {
  themeId: string;
  size?: number;
}) {
  const theme = getPieceTheme(themeId);
  const one = (type: PieceType, color: "w" | "b", k: string) => (
    <div key={k} style={{ width: size, height: size }}>
      {theme.style === "asset" ? (
        <AssetPiece
          set={theme.shapeSet as AssetSet}
          code={`${color}${type.toUpperCase()}`}
          filter={theme.filter}
        />
      ) : (
        renderMarble(theme, type, color, `prev-${themeId}-${k}`)
      )}
    </div>
  );
  return (
    <div className="flex items-center justify-center">
      {one("k", "w", "k")}
      {one("q", "b", "q")}
      {one("n", "w", "n")}
    </div>
  );
}
