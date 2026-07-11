import { Linking, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { Cody } from "@/Cody";
import { colors, font, space, type } from "@/theme";

const WEB = "https://chess-school.in";

export default function AssistedPlayScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const variant = mode === "puzzle" ? "puzzle" : "full";
  const title = variant === "full" ? "Assisted full game" : "Assisted puzzle drill";
  const url = `${WEB}/play/assisted?mode=${variant}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton label="Play" />
        <Text style={styles.h1}>{title}</Text>
      </View>
      <View style={styles.center}>
        <Cody expression="wave" size={112} />
        <Text style={styles.title}>Coached play on web (for now)</Text>
        <Text style={styles.body}>
          Full assisted coaching with voice, Next/Auto pacing, and undo is live on the web app.
          Native mobile support is on the way.
        </Text>
        <View style={styles.actions}>
          <Button label="Open in browser" onPress={() => void Linking.openURL(url)} />
          <Button label="Back to play setup" variant="outline" onPress={() => router.replace("/(tabs)/play")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingTop: 6,
  },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink, flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space[5], gap: space[4] },
  title: { ...type.lg, fontFamily: font.bold, color: colors.ink, textAlign: "center" },
  body: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, textAlign: "center", lineHeight: 22 },
  actions: { width: "100%", maxWidth: 280, gap: space[3] },
});
