import { type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { usePremiumKitTheme } from "./kitThemeContext";
import { shadowStyle } from "@/theme/premium/mapTokens";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  /** `.card` — default elevated surface card */
  variant?: "card" | "paper" | "sunken";
  testID?: string;
};

export function KitCard({ children, style, variant = "card", testID }: Props) {
  const { colors, radius, space } = usePremiumKitTheme();
  const bg =
    variant === "paper" ? colors.surfacePaper : variant === "sunken" ? colors.surfaceSunken : colors.surfaceCard;

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        shadowStyle("elev-2"),
        {
          backgroundColor: bg,
          borderRadius: radius.lg,
          borderColor: colors.hairline,
          padding: space["4"],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
