import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { settings, useSettings, BOARD_THEMES, type BoardTheme } from "@/settings";
import { Piece, PIECE_THEMES } from "@/Piece";
import { colors, font, radius, shadowCard } from "@/theme";

const THEMES: { id: BoardTheme; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "green", label: "Green" },
  { id: "wood", label: "Wood" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const s = useSettings();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.h1}>Settings</Text>
        </View>

        <Text style={styles.section}>Feel</Text>
        <View style={styles.card}>
          <Row label="Sound effects" hint="Moves, captures, wins">
            <Switch value={s.sound} onValueChange={(v) => settings.set("sound", v)} trackColor={{ true: colors.brand, false: colors.surfaceSunken }} />
          </Row>
          <View style={styles.divider} />
          <Row label="Haptics" hint="Vibration feedback">
            <Switch value={s.haptics} onValueChange={(v) => settings.set("haptics", v)} trackColor={{ true: colors.brand, false: colors.surfaceSunken }} />
          </Row>
          <View style={styles.divider} />
          <Row label="Reduce motion" hint="Minimize animations">
            <Switch value={s.reducedMotion} onValueChange={(v) => settings.set("reducedMotion", v)} trackColor={{ true: colors.brand, false: colors.surfaceSunken }} />
          </Row>
        </View>

        <Text style={styles.section}>Piece set</Text>
        <View style={styles.pieces}>
          {PIECE_THEMES.map((t) => {
            const on = s.pieceTheme === t.id;
            return (
              <Pressable
                key={t.id}
                testID={`piece-${t.id}`}
                style={[styles.pieceCard, on && { borderColor: colors.brand, borderWidth: 2 }]}
                onPress={() => settings.set("pieceTheme", t.id)}
              >
                <View style={styles.pieceRow}>
                  <Piece type="k" color="w" size={30} gid={`pv-${t.id}-wk`} themeId={t.id} />
                  <Piece type="q" color="b" size={30} gid={`pv-${t.id}-bq`} themeId={t.id} />
                </View>
                <Text style={styles.pieceLabel}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Board theme</Text>
        <View style={styles.themes}>
          {THEMES.map((t) => {
            const c = BOARD_THEMES[t.id];
            const on = s.boardTheme === t.id;
            return (
              <Pressable
                key={t.id}
                testID={`theme-${t.id}`}
                style={[styles.theme, on && { borderColor: colors.brand, borderWidth: 2 }]}
                onPress={() => settings.set("boardTheme", t.id)}
              >
                <View style={styles.swatch}>
                  <View style={{ flex: 1, backgroundColor: c.light }} />
                  <View style={{ flex: 1, backgroundColor: c.dark }} />
                </View>
                <Text style={styles.themeLabel}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 8 },
  close: { fontSize: 20, color: colors.ink500, fontFamily: font.bold },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.ink },
  section: { fontSize: 13, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, paddingHorizontal: 16, ...shadowCard },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  rowLabel: { fontSize: 15, fontFamily: font.bold, color: colors.ink },
  rowHint: { fontSize: 12, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.hairline },
  themes: { flexDirection: "row", gap: 12 },
  theme: { flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.md, padding: 10, alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  swatch: { width: 56, height: 56, borderRadius: 8, overflow: "hidden", flexDirection: "row" },
  themeLabel: { fontSize: 12, fontFamily: font.bold, color: colors.ink, marginTop: 8 },
  pieces: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pieceCard: { width: "31%", backgroundColor: colors.surfaceCard, borderRadius: radius.md, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  pieceRow: { flexDirection: "row" },
  pieceLabel: { fontSize: 11.5, fontFamily: font.bold, color: colors.ink, marginTop: 6 },
});
