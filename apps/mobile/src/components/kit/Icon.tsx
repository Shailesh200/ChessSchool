import Svg, { Circle, Path, type NumberProp } from "react-native-svg";
import type { KitIconName } from "./kitIconPaths";
import { KIT_LUCIDE_ICONS } from "./kitIconPaths";
import { usePremiumKitTheme } from "./kitThemeContext";

type Props = {
  name: KitIconName;
  size?: number;
  color?: string;
  strokeWidth?: NumberProp;
};

/** Lucide-derived line icons from the Premium Illustrated kit. */
export function KitIcon({ name, size = 24, color, strokeWidth = 2 }: Props) {
  const { colors } = usePremiumKitTheme();
  const tint = color ?? colors.ink;
  const def = KIT_LUCIDE_ICONS[name];
  if (!def) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {def.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={tint}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

export type { KitIconName };
