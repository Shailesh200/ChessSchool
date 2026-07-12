import { memo } from "react";
import { Image, Platform, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop, SvgXml } from "react-native-svg";
import {
  getPieceTheme,
  QUEEN_BALLS,
  SHAPES,
  type AssetSet,
  type PieceThemeId,
  type PieceType,
} from "./pieceThemes";
import { getPieceSvg } from "./pieceSvgContent";
import { scopePieceSvg } from "./pieceSvgScope";

export type { PieceThemeId };
export { PIECE_THEMES, getPieceTheme } from "./pieceThemes";

type Pal = { fill: string; stroke: string };

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amt > 0 ? c + (255 - c) * amt : c * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function AssetPiece({
  set,
  code,
  size,
  scope,
  filter,
}: {
  set: AssetSet;
  code: string;
  size: number;
  scope: string;
  filter?: string;
}) {
  const raw = getPieceSvg(set, code);
  if (!raw) return <View style={{ width: size, height: size }} />;
  const xml = scopePieceSvg(raw, scope);

  if (Platform.OS === "web") {
    const webFilter =
      filter === "neon"
        ? "drop-shadow(0 0 2px #5dffb8) drop-shadow(0 0 5px #5ec8ff) saturate(1.35)"
        : undefined;
    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(xml)}`;
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, ...(webFilter ? { filter: webFilter } : {}) } as object}
        resizeMode="contain"
      />
    );
  }

  return (
    <View style={{ width: size, height: size, opacity: filter === "neon" ? 0.95 : 1 }}>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}

function MarblePiece({ type, pal, gid, size }: { type: PieceType; pal: Pal; gid: string; size: number }) {
  const fill = `url(#${gid})`;
  return (
    <Svg viewBox="0 0 45 45" width={size} height={size}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0.25" y2="1">
          <Stop offset="0" stopColor={shade(pal.fill, 0.34)} />
          <Stop offset="0.5" stopColor={pal.fill} />
          <Stop offset="1" stopColor={shade(pal.fill, -0.22)} />
        </LinearGradient>
        <LinearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.5} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Ellipse cx="22.5" cy="39.6" rx="12" ry="2.1" fill="rgba(0,0,0,0.16)" />
      <Path
        d={SHAPES[type]}
        fill={fill}
        stroke={pal.stroke}
        strokeWidth={1.1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {type === "q" &&
        QUEEN_BALLS.map(([cx, cy], i) => (
          <Circle key={i} cx={cx} cy={cy} r="2.4" fill={fill} stroke={pal.stroke} strokeWidth={1.1} />
        ))}
      {type === "k" && (
        <Path
          d="M21.4 4h2.2v2h2v2.1h-2v2h-2.2v-2h-2V6h2z"
          fill={fill}
          stroke={pal.stroke}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      )}
      {type === "b" && <Circle cx="22.5" cy="5.4" r="1.9" fill={fill} stroke={pal.stroke} strokeWidth={1.6} />}
      <Ellipse cx="19" cy="15" rx="3.4" ry="6.4" fill={`url(#${gid}-g)`} opacity={0.7} rotation={-12} originX={19} originY={15} />
    </Svg>
  );
}

export const Piece = memo(function Piece({
  type,
  color,
  size,
  gid,
  themeId = "classic",
}: {
  type: PieceType;
  color: "w" | "b";
  size: number;
  gid: string;
  themeId?: PieceThemeId | string;
}) {
  const theme = getPieceTheme(themeId);
  const code = `${color}${type.toUpperCase()}`;

  if (theme.style === "asset") {
    return (
      <AssetPiece
        set={theme.shapeSet as AssetSet}
        code={code}
        size={size}
        scope={`${gid}-${theme.shapeSet}-${code}`}
        filter={theme.filter}
      />
    );
  }

  const pal = color === "w" ? theme.white : theme.black;
  return <MarblePiece type={type} pal={pal} gid={gid} size={size} />;
});

/** Picker swatch — three pieces like web Theme Studio. */
export function PiecePreview({ themeId, size = 30 }: { themeId: string; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 }}>
      <Piece type="k" color="w" size={size} gid={`prev-${themeId}-k`} themeId={themeId} />
      <Piece type="q" color="b" size={size} gid={`prev-${themeId}-q`} themeId={themeId} />
      <Piece type="n" color="w" size={size} gid={`prev-${themeId}-n`} themeId={themeId} />
    </View>
  );
}
