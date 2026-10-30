import Svg, { Circle, Path, Rect, type NumberProp } from "react-native-svg";
import type { KitIconName } from "./kitIconPaths";
import { KIT_LUCIDE_ICONS } from "./kitIconPaths";
import { usePremiumKitTheme } from "./kitThemeContext";

type Props = {
  name: KitIconName;
  size?: number;
  color?: string;
  strokeWidth?: NumberProp;
  /** Filled glyph (current-node play mark). */
  filled?: boolean;
};

/** Lucide icons from bundled kit SVGs (assets/kit/icons). */
export function KitIcon({ name, size = 24, color, strokeWidth = 2, filled = false }: Props) {
  const { colors } = usePremiumKitTheme();
  const tint = color ?? colors.ink;
  const def = KIT_LUCIDE_ICONS[name];
  if (!def) return null;
  const strokeProps = {
    stroke: tint,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {def.paths.map((d, i) => (
        <Path key={`p-${i}`} d={d} fill={filled ? tint : "none"} {...strokeProps} />
      ))}
      {def.circles.map((c, i) => (
        <Circle key={`c-${i}`} cx={c.cx} cy={c.cy} r={c.r} {...strokeProps} />
      ))}
      {def.rects.map((r, i) => (
        <Rect
          key={`r-${i}`}
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          rx={r.rx}
          {...strokeProps}
        />
      ))}
    </Svg>
  );
}

export type { KitIconName };
