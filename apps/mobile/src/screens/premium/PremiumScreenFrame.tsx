import { type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions, type ViewStyle } from "react-native";
import { usePremiumKitTheme } from "@/components/kit";

const MAX_CONTENT = 390;

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  scroll?: boolean;
  testID?: string;
};

/** Centers premium dex layouts at 390dp; safe at 320px and 200% text scale. */
export function PremiumScreenFrame({ children, style, contentStyle, scroll = true, testID }: Props) {
  const { width } = useWindowDimensions();
  const { colors, space } = usePremiumKitTheme();
  const pad = width > MAX_CONTENT ? (width - MAX_CONTENT) / 2 : 0;

  const body = (
    <View
      testID={testID}
      style={[
        {
          width: "100%",
          maxWidth: MAX_CONTENT,
          alignSelf: "center",
          paddingHorizontal: space["4"],
          paddingBottom: space["8"],
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.surface, paddingHorizontal: pad }, style]}>
        {body}
      </View>
    );
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.surface }, style]}
      contentContainerStyle={{ paddingHorizontal: pad, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      {body}
    </ScrollView>
  );
}

export const premiumScreenStyles = StyleSheet.create({
  h1: { letterSpacing: -0.4 },
  section: { marginTop: 20, marginBottom: 8 },
});
