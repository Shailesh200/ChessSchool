import Svg, { Circle, Path, Rect } from "react-native-svg";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useAppTheme } from "./ThemeProvider";
import { font, type } from "./theme";

/** ChessSchool wordmark + academic crest (matches web Logo). */
export function Logo({ withText = true, size = 32, style }: { withText?: boolean; size?: number; style?: ViewStyle }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.row, style]}>
      <Svg viewBox="0 0 40 40" width={size} height={size}>
        <Rect x="2" y="2" width="36" height="36" rx="11" fill={colors.brand} />
        <Path d="M13 30 h14 v-2 l-2-2 v-6 h-10 v6 l-2 2 z" fill="#fff" opacity={0.95} />
        <Rect x="14" y="16" width="2.5" height="3" fill="#fff" />
        <Rect x="18.75" y="16" width="2.5" height="3" fill="#fff" />
        <Rect x="23.5" y="16" width="2.5" height="3" fill="#fff" />
        <Path d="M20 7 L31 12 L20 17 L9 12 Z" fill="#f6c343" />
        <Path d="M24 14.7 v3.2 c0 1.6 -8 1.6 -8 0 v-3.2" fill="#e0a92e" />
        <Circle cx="31" cy="12" r="1.4" fill="#f6c343" />
        <Path d="M31 12 v4" stroke="#f6c343" strokeWidth="1" />
      </Svg>
      {withText && (
        <Text style={[styles.wordmark, { color: colors.ink }]}>
          Chess<Text style={{ color: colors.brand }}>School</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: { ...type.xl, fontFamily: font.bold, letterSpacing: -0.3 },
});
