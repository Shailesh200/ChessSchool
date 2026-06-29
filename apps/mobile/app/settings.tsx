import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { settings, useSettings, BOARD_THEMES, type BoardTheme } from "@/settings";
import { Piece, PIECE_THEMES } from "@/Piece";
import { Slider } from "@/Slider";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

const THEMES: { id: BoardTheme; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "green", label: "Green" },
  { id: "wood", label: "Wood" },
];
const track = { true: colors.brand, false: colors.surfaceSunken };

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

        <Text style={styles.section}>Sound & feel</Text>
        <View style={styles.card}>
          <Row label="Sound effects" hint="Moves, captures, wins">
            <Switch value={s.sound} onValueChange={(v) => settings.set("sound", v)} trackColor={track} />
          </Row>
          <Divider />
          <SliderRow label="Volume" hint={`${Math.round(s.volume * 100)}%`} value={s.volume} min={0} max={1} step={0.05} onChange={(v) => settings.set("volume", v)} />
          <Divider />
          <Row label="Haptics" hint="Vibration on supported devices">
            <Switch value={s.haptics} onValueChange={(v) => settings.set("haptics", v)} trackColor={track} />
          </Row>
        </View>

        <Text style={styles.section}>Accessibility</Text>
        <View style={styles.card}>
          <Row label="Reduce motion" hint="Minimize animations">
            <Switch value={s.reducedMotion} onValueChange={(v) => settings.set("reducedMotion", v)} trackColor={track} />
          </Row>
          <Divider />
          <Row label="High contrast" hint="Stronger borders & text">
            <Switch value={s.highContrast} onValueChange={(v) => settings.set("highContrast", v)} trackColor={track} />
          </Row>
          <Divider />
          <Row label="Colorblind board" hint="Deuteranopia-friendly palette">
            <Switch value={s.colorblind} onValueChange={(v) => settings.set("colorblind", v)} trackColor={track} />
          </Row>
        </View>

        <Text style={styles.section}>Learning & board</Text>
        <View style={styles.card}>
          <Row label="Coach hints" hint="Show arrows and tips">
            <Switch value={s.hints} onValueChange={(v) => settings.set("hints", v)} trackColor={track} />
          </Row>
          <Divider />
          <SliderRow label="Bot difficulty" hint={`Target ELO ${s.targetElo}`} value={s.targetElo} min={300} max={2500} step={100} onChange={(v) => settings.set("targetElo", v)} />
        </View>

        <Text style={styles.section}>Piece set</Text>
        <View style={styles.pieces}>
          {PIECE_THEMES.map((t) => {
            const on = s.pieceTheme === t.id;
            return (
              <Pressable key={t.id} testID={`piece-${t.id}`} style={[styles.pieceCard, on && styles.selOn]} onPress={() => settings.set("pieceTheme", t.id)}>
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
              <Pressable key={t.id} testID={`theme-${t.id}`} style={[styles.theme, on && styles.selOn]} onPress={() => settings.set("boardTheme", t.id)}>
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
function SliderRow({ label, hint, value, min, max, step, onChange }: { label: string; hint: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.rowBetween}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <View style={{ marginTop: space[2] }}>
        <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
      </View>
    </View>
  );
}
const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space[5] },
  header: { flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[2] },
  close: { fontSize: 20, color: colors.ink500, fontFamily: font.bold },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  section: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginTop: space[5], marginBottom: space[2] },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, paddingHorizontal: space[4], ...shadowCard },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: space[3] },
  sliderRow: { paddingVertical: space[3] },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  rowHint: { ...type.xs, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.hairline },
  selOn: { borderColor: colors.brand, borderWidth: 2 },
  themes: { flexDirection: "row", gap: space[3] },
  theme: { flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.md, padding: space[2], alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  swatch: { width: 56, height: 56, borderRadius: 8, overflow: "hidden", flexDirection: "row" },
  themeLabel: { ...type.xs, fontFamily: font.bold, color: colors.ink, marginTop: space[2] },
  pieces: { flexDirection: "row", flexWrap: "wrap", gap: space[2.5] },
  pieceCard: { width: "31%", backgroundColor: colors.surfaceCard, borderRadius: radius.md, paddingVertical: space[3], alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  pieceRow: { flexDirection: "row" },
  pieceLabel: { fontSize: 11.5, fontFamily: font.bold, color: colors.ink, marginTop: space[1.5] },
});
