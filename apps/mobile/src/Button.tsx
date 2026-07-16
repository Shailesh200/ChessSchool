import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, font, radius, type } from "./theme";
import { haptics } from "./haptics";

/**
 * Tactile 3D button matching web's --shadow-button (a solid darker bottom edge
 * that "presses in" on tap). Variants: primary (brand) / accent / outline.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  block = true,
  disabled = false,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "accent" | "success" | "outline" | "danger";
  size?: "sm" | "lg";
  block?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const outline = variant === "outline";
  const bg = disabled
    ? colors.surfaceSunken
    : outline
      ? colors.surfaceCard
      : variant === "danger"
        ? colors.danger
        : variant === "accent"
          ? colors.accent
          : variant === "success"
            ? colors.success
            : colors.brand;
  const edge = outline
    ? colors.hairline
    : variant === "danger"
      ? "#b91c1c"
      : variant === "accent"
        ? colors.accent600
        : variant === "success"
          ? colors.success600
          : colors.brand700;
  const fg = disabled ? colors.ink300 : outline ? colors.ink : "#fff";
  const padV = size === "lg" ? 14 : 9;
  const labelType = size === "lg" ? type.sm : type.xs;

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        haptics.tap();
        onPress();
      }}
      onPressIn={() => !disabled && setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[block && { alignSelf: "stretch" }, style, disabled && { opacity: 0.55 }]}
    >
      <View
        style={{
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: padV,
          paddingHorizontal: 20,
          alignItems: "center",
          borderWidth: outline ? 1 : 0,
          borderColor: edge,
          borderBottomWidth: pressed ? 1 : 4,
          borderBottomColor: edge,
          marginTop: pressed ? 3 : 0,
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={[styles.label, { color: fg, fontSize: labelType.fontSize, lineHeight: labelType.lineHeight }]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.bold },
});
