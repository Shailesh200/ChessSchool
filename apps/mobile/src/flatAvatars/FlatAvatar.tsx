import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg from "react-native-svg";
import { FlatAvatarArt } from "./art";
import { FLAT_AVATAR_TONES, type FlatAvatarId } from "./catalog";
import { resolveAvatar } from "../iconMaps";

const SIZE = { sm: 44, md: 56, lg: 68, xl: 84 } as const;
export type FlatAvatarSize = keyof typeof SIZE;

/** Flat illustrated portrait — gradient tile + original character art. */
export function FlatAvatar({
  id,
  size = "md",
  selected,
}: {
  id: FlatAvatarId | string;
  size?: FlatAvatarSize | number;
  selected?: boolean;
}) {
  const resolved = resolveAvatar(id);
  const tone = FLAT_AVATAR_TONES[resolved];
  const px = typeof size === "number" ? size : SIZE[size];
  const pad = Math.round(px * 0.08);
  const radius = Math.round(px * 0.28);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: px,
          height: px,
          borderRadius: radius,
          borderColor: tone.ring,
          borderWidth: 2,
        },
        selected && { shadowColor: tone.ring, shadowOpacity: 0.9, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={[tone.from, tone.to]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius - 2 }]}
      />
      <Svg viewBox="0 0 96 96" width={px - pad} height={px - pad}>
        <FlatAvatarArt id={resolved} />
      </Svg>
    </View>
  );
}

export function flatAvatarPx(size: FlatAvatarSize): number {
  return SIZE[size];
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
