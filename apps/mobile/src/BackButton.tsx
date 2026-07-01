import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "./Icon";
import { colors, font, radius, shadowCard, space, type } from "./theme";

/** Pill back button matching web's BackButton (used on sub-screens). */
export function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
      <View style={{ transform: [{ rotate: "180deg" }] }}>
        <Icon name="chevronRight" size={18} color={colors.ink} />
      </View>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, backgroundColor: colors.surfaceCard, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1.5], ...shadowCard },
  text: { ...type.sm, fontFamily: font.bold, color: colors.ink },
});
