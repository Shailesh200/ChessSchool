import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { useSettings, settings } from "@/settings";
import { Slider } from "@/Slider";
import { TopBar } from "@/TopBar";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

const COACHES = [
  { value: "friendly", label: "Friendly", emoji: "😊" },
  { value: "strict", label: "Strict", emoji: "🎩" },
  { value: "mentor", label: "Mentor", emoji: "🧑‍🏫" },
  { value: "tactical", label: "Tactical", emoji: "⚔️" },
  { value: "minimal", label: "Minimal", emoji: "🎯" },
];
const track = { true: colors.brand, false: colors.surfaceSunken };

export default function SettingsScreen() {
  const router = useRouter();
  const { guest, exitGuest } = useAuth();
  const s = useSettings();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <Text style={styles.h1}>Settings</Text>

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

        <Text style={styles.section}>Coach personality</Text>
        <View style={styles.coachGrid}>
          {COACHES.map((c) => {
            const on = s.coachPersonality === c.value;
            return (
              <Pressable key={c.value} style={[styles.coachCard, on && styles.coachCardOn]} onPress={() => settings.set("coachPersonality", c.value)}>
                <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
                <Text style={[styles.coachLabel, on && { color: colors.brand }]} numberOfLines={1}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {guest ? (
          <View style={styles.guestCard}>
            <Text style={styles.guestTitle}>Guest mode</Text>
            <Text style={styles.guestCopy}>Progress stays on this device until you enroll. Log in to sync across web and mobile.</Text>
            <Button label="Log in or enroll →" size="sm" onPress={() => { exitGuest(); router.push("/login"); }} />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.rowLabel}>Account</Text>
            <Text style={styles.rowHint}>Settings sync to your account when logged in.</Text>
          </View>
        )}

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
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink, marginTop: space[3], marginBottom: space[1] },
  section: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginTop: space[5], marginBottom: space[2] },
  coachGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  coachCard: { width: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: space[2], backgroundColor: colors.surfaceCard, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[3], borderWidth: 2, borderColor: "transparent", ...shadowCard },
  coachCardOn: { borderColor: colors.brand },
  coachLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, paddingHorizontal: space[4], ...shadowCard },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: space[3] },
  sliderRow: { paddingVertical: space[3] },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  rowHint: { ...type.xs, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.hairline },
  guestCard: { backgroundColor: colors.brand50, borderRadius: radius.card, borderWidth: 1, borderColor: colors.brand100, padding: space[4], gap: space[2], marginTop: space[4] },
  guestTitle: { ...type.base, fontFamily: font.bold, color: colors.ink },
  guestCopy: { ...type.sm, fontFamily: font.medium, color: colors.ink500, lineHeight: 20 },
});
