import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { usePremiumKitTheme } from "./kitThemeContext";
import { shadowStyle } from "@/theme/premium/mapTokens";

export type KitButtonVariant = "primary" | "accent" | "outline" | "ghost" | "danger";
export type KitButtonSize = "sm" | "md" | "lg";

type Props = {
  label: string;
  onPress: () => void;
  variant?: KitButtonVariant;
  size?: KitButtonSize;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  className?: string;
};

/** `.btn` / `.btn--primary` tactile pill from kit/components.css */
export function KitButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  block = true,
  disabled = false,
  loading = false,
  style,
  testID,
}: Props) {
  const { colors, radius, buttonHeight, type, font } = usePremiumKitTheme();
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  const outline = variant === "outline";
  const ghost = variant === "ghost";

  const bg = inactive
    ? colors.surfaceSunken
    : ghost
      ? "transparent"
      : outline
        ? colors.surfaceCard
        : variant === "danger"
          ? colors.danger
          : variant === "accent"
            ? colors.accent
            : colors.brand;

  const edge = ghost
    ? "transparent"
    : outline
      ? colors.hairline
      : variant === "danger"
        ? colors.danger
        : variant === "accent"
          ? colors.accent600
          : colors.brand700;

  const fg = inactive ? colors.ink300 : ghost ? colors.ink700 : outline ? colors.ink : "#fff";

  const height = buttonHeight[size] ?? 48;
  const padH = size === "sm" ? 16 : size === "md" ? 24 : 32;
  const labelType = size === "lg" ? type.lg : size === "md" ? type.base : type.sm;
  const depth = ghost || outline ? 0 : 4;

  return (
    <Pressable
      testID={testID}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={() => {
        if (inactive) return;
        haptics.tap();
        sfx.play("select");
        onPress();
      }}
      onPressIn={() => !inactive && setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[block && styles.block, style, inactive && styles.inactive]}
    >
      <View
        style={[
          styles.btn,
          shadowStyle("elev-1"),
          {
            height,
            backgroundColor: bg,
            borderRadius: radius.pill,
            paddingHorizontal: padH,
            borderWidth: outline ? 2 : 0,
            borderColor: edge,
            borderBottomWidth: pressed ? Math.max(1, depth - 3) : depth || (outline ? 2 : 0),
            borderBottomColor: edge,
            marginTop: pressed && depth ? 3 : 0,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={{
              fontFamily: font.displayBold,
              color: fg,
              fontSize: labelType.fontSize,
              lineHeight: labelType.lineHeight,
              letterSpacing: -0.2,
            }}
          >
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: "stretch" },
  inactive: { opacity: 0.55 },
  btn: { alignItems: "center", justifyContent: "center" },
});
