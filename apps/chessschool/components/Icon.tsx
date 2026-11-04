import { googleMark, icons, type IconName } from "@chessschool/design";
import Svg, { Path } from "react-native-svg";

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      {icons[name].map((p, i) =>
        "fill" in p && p.fill ? (
          <Path key={i} d={p.d} fill={color} opacity={p.opacity ?? 1} />
        ) : (
          <Path key={i} d={p.d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ),
      )}
    </Svg>
  );
}

export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {googleMark.map((p) => (
        <Path key={p.color} d={p.d} fill={p.color} />
      ))}
    </Svg>
  );
}
