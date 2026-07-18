import { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "./ThemeProvider";
import { radius, shadowCard, space } from "./theme";

/** Web `components/ui/Card` — rounded-card, hairline border, elev-2, p-5. */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        {
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.hairline,
          backgroundColor: colors.surfaceCard,
          padding: padded ? space[5] : 0,
          ...shadowCard,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
