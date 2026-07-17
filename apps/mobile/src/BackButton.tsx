import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "./Icon";
import { useAppTheme } from "./ThemeProvider";
import { font, radius, shadowCard, space, type } from "./theme";

/** Pill back button matching web's BackButton (used on sub-screens). */
export function BackButton({
  label = "Back",
  onPress,
}: {
  label?: string;
  onPress?: () => void;
}) {
  const router = useRouter();
  const { colors } = useAppTheme();
  return (
    <Pressable
      style={[styles.back, { backgroundColor: colors.surfaceCard }]}
      onPress={() => (onPress ? onPress() : router.back())}
      hitSlop={8}
    >
      <View style={{ transform: [{ rotate: "180deg" }] }}>
        <Icon name="chevronRight" size={18} color={colors.ink} />
      </View>
      <Text style={[styles.text, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    paddingVertical: space[1.5],
    ...shadowCard,
  },
  text: { ...type.sm, fontFamily: font.bold },
});
