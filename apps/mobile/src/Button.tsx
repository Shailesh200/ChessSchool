import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { buttonHeight, font, radius } from "./theme";
import { haptics } from "./haptics";
import { sfx } from "./sfx";
import { useAppTheme } from "./ThemeProvider";
import { useType } from "./typography";

/**
 * Tactile pill button matching web `components/ui/Button`:
 * rounded-pill, fixed heights (h-11/12/14), solid 4px bottom edge.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  block = true,
  disabled = false,
  loading = false,
  style,
  testID,
  haptic = true,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "accent" | "success" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  /** Set false when the caller already fires a haptic/SFX for this action. */
  haptic?: boolean;
}) {
  const { colors } = useAppTheme();
  const type = useType();
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
            : variant === "success"
              ? colors.success
              : colors.brand;

  const edge = ghost
    ? "transparent"
    : outline
      ? colors.hairline
      : variant === "danger"
        ? colors.danger700
        : variant === "accent"
          ? colors.accent600
          : variant === "success"
            ? colors.success600
            : colors.brand700;

  const fg = inactive
    ? colors.ink300
    : ghost
      ? colors.ink700
      : outline
        ? colors.ink
        : "#fff";

  const height = buttonHeight[size];
  const padH = size === "sm" ? 16 : size === "md" ? 24 : 32;
  const labelType = size === "lg" ? type.lg : size === "md" ? type.base : type.sm;
  const edgeW = ghost ? 0 : outline ? 2 : 0;
  const bottomEdge = ghost ? 0 : outline ? 2 : 4;

  return (
    <Pressable
      testID={testID}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={() => {
        if (inactive) return;
        if (haptic) {
          haptics.tap();
          sfx.play("select");
        }
        onPress();
      }}
      onPressIn={() => !inactive && setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[block && { alignSelf: "stretch" }, style, inactive && { opacity: 0.55 }]}
    >
      <View
        style={{
          height,
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: padH,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: edgeW,
          borderColor: edge,
          borderBottomWidth: pressed ? Math.max(1, bottomEdge - 3) : bottomEdge,
          borderBottomColor: edge,
          marginTop: pressed && bottomEdge ? 3 : 0,
        }}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={[styles.label, { color: fg, fontSize: labelType.fontSize, lineHeight: labelType.lineHeight }]}
          >
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.bold, letterSpacing: -0.2 },
});
