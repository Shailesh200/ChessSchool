import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { ActivityIndicator } from "react-native";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "./premiumTokens";

type Variant = "brand" | "accent" | "ghost" | "line" | "soft";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: ViewStyle;
};

export function DexButton({
  label,
  onPress,
  variant = "brand",
  disabled,
  loading,
  testID,
  style,
}: Props) {
  const v = stylesFor(variant, disabled || loading);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.base, v.box, pressed && !disabled ? styles.pressed : null, style]}
    >
      {loading ? (
        <ActivityIndicator color={v.spinner} />
      ) : (
        <Text style={[styles.label, v.text]}>{label}</Text>
      )}
    </Pressable>
  );
}

function stylesFor(variant: Variant, off?: boolean) {
  if (off) {
    return {
      box: { backgroundColor: premiumColors.lineStrong, shadowOpacity: 0 },
      text: { color: premiumColors.textMuted },
      spinner: premiumColors.textMuted,
    };
  }
  switch (variant) {
    case "accent":
      return {
        box: { backgroundColor: premiumColors.accent, shadowColor: premiumColors.accentEdge },
        text: { color: premiumColors.textOnAccent },
        spinner: premiumColors.textOnAccent,
      };
    case "ghost":
      return {
        box: { backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
        text: { color: premiumColors.text },
        spinner: premiumColors.text,
      };
    case "line":
      return {
        box: {
          backgroundColor: premiumColors.surface,
          borderWidth: 1.5,
          borderColor: premiumColors.lineStrong,
          shadowOpacity: 0,
          elevation: 0,
        },
        text: { color: premiumColors.text },
        spinner: premiumColors.text,
      };
    case "soft":
      return {
        box: { backgroundColor: premiumColors.surfaceSoft, shadowOpacity: 0, elevation: 0 },
        text: { color: premiumColors.brandSoftText },
        spinner: premiumColors.brandSoftText,
      };
    default:
      return {
        box: { backgroundColor: premiumColors.brand, shadowColor: premiumColors.brandEdge },
        text: { color: premiumColors.textOnBrand },
        spinner: premiumColors.textOnBrand,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: premiumRadius.pill,
    paddingHorizontal: premiumSpace[6],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: premiumColors.brandEdge,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  pressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } },
  label: {
    ...premiumType.button,
    fontFamily: premiumFont.uiBold,
    textAlign: "center",
  },
});
