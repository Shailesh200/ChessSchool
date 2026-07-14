import { useState, useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View, Linking } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { PRIVACY_URL } from "@/constants";
import { useSettings, settings } from "@/settings";
import { exportBackupToFile, importBackup, storageEstimateKB, validateBackup } from "@/backup";
import { Slider } from "@/Slider";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { ConfirmDialog } from "@/ConfirmDialog";
import { toast } from "@/toast";
import { colors, font, radius, shadowCard, space } from "@/theme";
import { useType } from "@/typography";
import { COACH_VOICE_GROUPS, COACH_VOICE_OPTIONS, normalizeCoachVoice } from "@/coachVoices";
import { speakCoachText, stopCoachSpeech } from "@/coachSpeech";
import { Icon } from "@/Icon";
import { coachToneIcon, emojiToIcon } from "@/iconMaps";

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
  const type = useType();
  const styles = useMemo(() => makeStyles(type), [type]);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const storageKb = storageEstimateKB();

  async function pickImport() {
    const res = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const raw = await fetch(res.assets[0].uri).then((r) => r.text());
    const parsed = JSON.parse(raw) as unknown;
    const preview = validateBackup(parsed);
    if (!preview.ok) {
      toast(preview.reason ?? "Invalid backup", { tone: "danger" });
      return;
    }
    setPendingImport(parsed);
    setImportOpen(true);
  }

  return (
    <AppShell>
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
          <Divider />
          <SliderRow label="Text size" hint={`${Math.round(s.textScale * 100)}%`} value={s.textScale} min={0.85} max={1.25} step={0.05} onChange={(v) => settings.set("textScale", v)} />
        </View>

        <Text style={styles.section}>Developer</Text>
        <View style={styles.card}>
          <Row label="Performance diagnostics" hint="Show FPS & route timing HUD">
            <Switch value={s.diagnostics} onValueChange={(v) => settings.set("diagnostics", v)} trackColor={track} />
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

        <Text style={styles.section}>Coach voice</Text>
        <View style={styles.card}>
          <Row label="Coach speech" hint="Read coach lines aloud during matches">
            <Switch value={s.coachSpeech} onValueChange={(v) => settings.set("coachSpeech", v)} trackColor={track} />
          </Row>
        </View>

        {s.coachSpeech && (
          <>
            {COACH_VOICE_GROUPS.map((group) => (
              <View key={group.label}>
                <Text style={styles.voiceGroup}>{group.label}</Text>
                <View style={styles.voiceGrid}>
                  {group.ids.map((id) => {
                    const opt = COACH_VOICE_OPTIONS.find((v) => v.id === id)!;
                    const on = normalizeCoachVoice(s.coachVoice) === id;
                    return (
                      <Pressable
                        key={id}
                        style={[styles.voiceCard, on && styles.voiceCardOn]}
                        onPress={() => {
                          stopCoachSpeech();
                          settings.set("coachVoice", id);
                          void speakCoachText(
                            id === "auto"
                              ? "I'll match your coach personality."
                              : `Hi, I'm ${opt.title}. Ready when you are.`,
                          );
                        }}
                      >
                        <Icon name={emojiToIcon(opt.emoji)} size={22} color={on ? colors.brand : colors.ink} duotone />
                        <Text style={[styles.voiceTitle, on && { color: colors.brand }]} numberOfLines={1}>
                          {opt.title}
                        </Text>
                        <Text style={styles.voiceHint} numberOfLines={2}>
                          {opt.hint}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={styles.section}>Coach personality</Text>
        <View style={styles.coachGrid}>
          {COACHES.map((c) => {
            const on = s.coachPersonality === c.value;
            return (
              <Pressable key={c.value} style={[styles.coachCard, on && styles.coachCardOn]} onPress={() => settings.set("coachPersonality", c.value)}>
                <Icon name={coachToneIcon(c.value)} size={22} color={on ? colors.brand : colors.ink} duotone />
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
          <>
            <Text style={styles.section}>Your data</Text>
            <View style={styles.card}>
              <Text style={styles.rowLabel}>Offline ready</Text>
              <Text style={styles.rowHint}>
                {storageKb != null ? `~${storageKb} KB progress cached on this device.` : "Progress syncs when you're online."}
              </Text>
              <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3] }}>
                <Button label="Export backup" size="sm" variant="outline" onPress={() => void exportBackupToFile().then(() => toast("Backup exported", { tone: "success" })).catch(() => toast("Export failed", { tone: "danger" }))} />
                <Button label="Import backup" size="sm" variant="outline" onPress={() => void pickImport()} />
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.rowLabel}>Account</Text>
              <Text style={styles.rowHint}>Settings sync to your account when logged in.</Text>
              <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} style={{ marginTop: space[2] }}>
                <Text style={styles.privacyLink}>Privacy policy</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.version}>ChessSchool v{Constants.expoConfig?.version ?? "0.2.0"}</Text>
      </ScrollView>

      <ConfirmDialog
        open={importOpen}
        title="Import backup?"
        message="This replaces local progress, games, and settings on this device."
        confirmLabel="Import"
        tone="danger"
        onCancel={() => { setImportOpen(false); setPendingImport(null); }}
        onConfirm={() => {
          setImportOpen(false);
          void importBackup(pendingImport)
            .then((r) => {
              if (r.ok) toast("Backup imported", { tone: "success" });
              else toast(r.reason ?? "Import failed", { tone: "danger" });
            })
            .catch(() => toast("Import failed", { tone: "danger" }));
          setPendingImport(null);
        }}
      />
    </AppShell>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  const type = useType();
  const styles = useMemo(() => makeStyles(type), [type]);
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
function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const type = useType();
  const styles = useMemo(() => makeStyles(type), [type]);
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
function Divider() {
  const type = useType();
  const styles = useMemo(() => makeStyles(type), [type]);
  return <View style={styles.divider} />;
}

function makeStyles(type: ReturnType<typeof useType>) {
  return StyleSheet.create({
    content: { padding: space[5], paddingBottom: 100 },
    h1: { ...type.xl, fontFamily: font.bold, color: colors.ink, marginTop: space[3], marginBottom: space[1] },
    section: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginTop: space[5], marginBottom: space[2] },
    coachGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
    coachCard: {
      width: "47%",
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: space[2],
      backgroundColor: colors.surfaceCard,
      borderRadius: radius.md,
      paddingHorizontal: space[3],
      paddingVertical: space[3],
      borderWidth: 2,
      borderColor: "transparent",
      ...shadowCard,
    },
    coachCardOn: { borderColor: colors.brand },
    coachLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    voiceGroup: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginTop: space[3], marginBottom: space[2] },
    voiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
    voiceCard: {
      width: "30%",
      minWidth: 96,
      flexGrow: 1,
      alignItems: "center",
      backgroundColor: colors.surfaceCard,
      borderRadius: radius.md,
      padding: space[2],
      borderWidth: 2,
      borderColor: "transparent",
      ...shadowCard,
    },
    voiceCardOn: { borderColor: colors.brand, backgroundColor: colors.brand50 },
    voiceTitle: { ...type.xs, fontFamily: font.bold, color: colors.ink, marginTop: 4, textAlign: "center" },
    voiceHint: { ...type.xs, fontFamily: font.semibold, color: colors.ink300, fontSize: Math.max(9, Math.round(type.xs.fontSize * 0.75)), textAlign: "center", marginTop: 2 },
    card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, paddingHorizontal: space[4], ...shadowCard },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: space[3] },
    sliderRow: { paddingVertical: space[3] },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    rowLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    rowHint: { ...type.xs, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
    divider: { height: 1, backgroundColor: colors.hairline },
    guestCard: { backgroundColor: colors.brand50, borderRadius: radius.card, borderWidth: 1, borderColor: colors.brand100, padding: space[4], gap: space[2], marginTop: space[4] },
    guestTitle: { ...type.base, fontFamily: font.bold, color: colors.ink },
    guestCopy: { ...type.sm, fontFamily: font.medium, color: colors.ink500, lineHeight: type.sm.lineHeight },
    privacyLink: { ...type.sm, fontFamily: font.bold, color: colors.brand },
    version: { ...type.xs, fontFamily: font.medium, color: colors.ink300, textAlign: "center", marginTop: space[6], marginBottom: space[2] },
  });
}
