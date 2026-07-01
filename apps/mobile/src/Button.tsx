import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, font, radius } from "./theme";
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
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "accent" | "success" | "outline";
  size?: "sm" | "lg";
  block?: boolean;
  style?: ViewStyle;
}) {
  const [pressed, setPressed] = useState(false);
  const outline = variant === "outline";
  const bg = outline ? colors.surfaceCard : variant === "accent" ? colors.accent : variant === "success" ? colors.success : colors.brand;
  const edge = outline ? colors.hairline : variant === "accent" ? colors.accent600 : variant === "success" ? colors.success600 : colors.brand700;
  const fg = outline ? colors.ink : "#fff";
  const padV = size === "lg" ? 14 : 9;

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[block && { alignSelf: "stretch" }, style]}
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
          style={[styles.label, { color: fg, fontSize: size === "lg" ? 16 : 12 }]}
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
