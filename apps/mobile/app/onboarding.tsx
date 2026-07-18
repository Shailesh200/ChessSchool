import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { settings } from "@/settings";
import { saveOnboardingToServer } from "@/profile";
import { mutateProgress } from "@/progressStore";
import { Button } from "@/Button";
import { haptics } from "@/haptics";
import { Icon } from "@/Icon";
import { FlatAvatar } from "@/flatAvatars/FlatAvatar";
import { AVATAR_OPTIONS, emojiToIcon } from "@/iconMaps";
import type { FlatAvatarId } from "@/flatAvatars/catalog";
import { colors, font, radius, space, type } from "@/theme";

type Opt = { value: string; label: string; emoji: string };
const GOALS: Opt[] = [
  { value: "beat-friends", label: "Beat my friends", emoji: "🤝" },
  { value: "reach-1000", label: "Reach 1000 rating", emoji: "📈" },
  { value: "reach-1500", label: "Reach 1500 rating", emoji: "🚀" },
  { value: "openings", label: "Master openings", emoji: "📖" },
  { value: "tournament", label: "Tournament prep", emoji: "🏆" },
];
const EXPERIENCE: Opt[] = [
  { value: "600", label: "Brand new", emoji: "🌱" },
  { value: "900", label: "I know the rules", emoji: "🙂" },
  { value: "1400", label: "Club player", emoji: "♟️" },
  { value: "1900", label: "Strong player", emoji: "🔥" },
];
const TIME: Opt[] = [
  { value: "casual", label: "10–15 min/day", emoji: "🌱" },
  { value: "standard", label: "20–30 min/day", emoji: "📘" },
  { value: "serious", label: "45–60 min/day", emoji: "🔥" },
  { value: "competitive", label: "90+ min/day", emoji: "🏆" },
];
const COACH: Opt[] = [
  { value: "anxious_nerd", label: "Otto · Anxious / Nerd", emoji: "🤓" },
  { value: "genz", label: "Kira · GenZ", emoji: "✨" },
  { value: "sassy", label: "Skye · Sassy", emoji: "💅" },
  { value: "sarcastic", label: "Ash · Sarcastic", emoji: "😏" },
  { value: "egoistic", label: "Rex · Alpha", emoji: "🦁" },
];
const THEME: Opt[] = [
  { value: "default", label: "Classic", emoji: "🎓" },
  { value: "blue", label: "School Blue", emoji: "💙" },
  { value: "forest", label: "Forest", emoji: "🌲" },
  { value: "midnight", label: "Midnight", emoji: "🌙" },
];
// Each onboarding theme maps to a distinct board theme so the choice visibly applies.
const THEME_MAP: Record<string, import("@/settings").BoardTheme> = { default: "classic", blue: "midnight", forest: "tournament", midnight: "neon" };

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, finishOnboarding } = useAuth();
  const first = user?.name?.split(" ")[0] ?? "Student";

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [elo, setElo] = useState("");
  const [time, setTime] = useState("");
  const [coach, setCoach] = useState("");
  const [theme, setTheme] = useState("");
  const [avatar, setAvatar] = useState<FlatAvatarId | "">("");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const displayAvatar: FlatAvatarId = avatar || "ava-knight";

  const STEPS = [
    { title: `Welcome, ${first}!`, sub: "Let's tailor your studies. What's your main goal?", opts: GOALS, value: goal, set: setGoal },
    { title: "How experienced are you?", sub: "We'll set your starting bot strength.", opts: EXPERIENCE, value: elo, set: setElo },
    { title: "How much time per day?", sub: "This sets your study plan.", opts: TIME, value: time, set: setTime },
    { title: "Pick your coach", sub: "Choose the tone you like.", opts: COACH, value: coach, set: setCoach },
    { title: "Choose a theme", sub: "You can change it anytime.", opts: THEME, value: theme, set: setTheme },
  ];
  const isAvatar = step === STEPS.length;
  const total = STEPS.length + 1;
  const current = STEPS[step];
  const canNext = isAvatar ? !!avatar : !!current?.value;

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    setFinishError(null);
    settings.set("goal", goal);
    settings.set("targetElo", Number(elo) || 600);
    settings.set("planTier", (time || "standard") as never);
    settings.set("coachCharacter", (coach || "sarcastic") as never);
    settings.set("appTheme", theme || "default");
    settings.set("avatar", displayAvatar);
    try {
      await saveOnboardingToServer(goal, displayAvatar);
      await mutateProgress((snap) => ({ ...snap, settings: settings.get() }));
      haptics.success();
      finishOnboarding();
      router.replace("/account");
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : "Could not complete enrollment.");
      setFinishing(false);
    }
  }

  if (finishing) {
    return (
      <SafeAreaView style={[styles.safe, styles.finishCenter]} edges={["top", "bottom"]}>
        <FlatAvatar id={displayAvatar} size={72} />
        <Text style={styles.finishTitle}>Welcome to ChessSchool, {first}!</Text>
        <Text style={styles.finishSub}>Issuing your Student ID…</Text>
        <ActivityIndicator color={colors.brand} style={{ marginTop: space[4] }} />
        {finishError && (
          <>
            <Text style={styles.finishError}>{finishError}</Text>
            <Button label="Try again" variant="outline" onPress={() => { setFinishing(false); void finish(); }} />
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.welcome}>
          <View style={styles.avatarCircle}>
            <FlatAvatar id={displayAvatar} size={48} />
          </View>
          <Text style={styles.welcomeText}>Welcome to ChessSchool, {first}!</Text>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.track}><View style={[styles.fill, { width: `${((step + 1) / total) * 100}%` }]} /></View>
          <Text style={styles.stepCount}>{step + 1}/{total}</Text>
        </View>

        <Text style={styles.title}>{isAvatar ? "Pick your avatar" : current!.title}</Text>
        <Text style={styles.sub}>{isAvatar ? "It appears on your Student ID." : current!.sub}</Text>
        {!isAvatar && step === 1 && elo === "600" && (
          <View style={styles.preschoolTip}>
            <Icon name="seedling" size={16} color={colors.brand} duotone />
            <Text style={styles.preschoolTipText}>
              We&apos;ll recommend optional Pre-School first — board, pieces & notation. Skip anytime.
            </Text>
          </View>
        )}

        {isAvatar ? (
          <View style={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((a) => (
              <Pressable key={a} style={[styles.avatarCell, avatar === a && styles.selOn]} onPress={() => { setAvatar(a); haptics.select(); }}>
                <FlatAvatar id={a} size={40} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.optGrid}>
            {current!.opts.map((o) => {
              const on = current!.value === o.value;
              return (
                <Pressable key={o.value} style={[styles.opt, on && styles.selOn]} onPress={() => { current!.set(o.value); haptics.select(); }}>
                  <Icon name={emojiToIcon(o.emoji)} size={24} color={on ? colors.brand : colors.ink} duotone />
                  <Text style={styles.optLabel}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <View style={{ flex: 1 }}>
            <Button label="Back" variant="outline" onPress={() => setStep((s) => s - 1)} />
          </View>
        )}
        <View style={{ flex: 2 }}>
          <Button label={isAvatar ? "Enroll" : "Continue"} onPress={() => (canNext ? (isAvatar ? finish() : setStep((s) => s + 1)) : undefined)} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space[5], paddingBottom: 20 },
  welcome: { alignItems: "center", gap: space[2], marginBottom: space[5] },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand50, justifyContent: "center", alignItems: "center" },
  welcomeText: { ...type.lg, fontFamily: font.bold, color: colors.ink, textAlign: "center" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: space[2], marginBottom: space[5] },
  track: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden" },
  fill: { height: 10, borderRadius: radius.pill, backgroundColor: colors.brand },
  stepCount: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
  title: { ...type["2xl"], fontFamily: font.bold, color: colors.ink },
  sub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: space[1], marginBottom: space[4] },
  preschoolTip: { flexDirection: "row", alignItems: "flex-start", gap: space[2], ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: -space[2], marginBottom: space[4], borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceSunken, padding: space[3] },
  preschoolTipText: { flex: 1, ...type.xs, fontFamily: font.semibold, color: colors.ink500 },
  optGrid: { gap: space[2] },
  opt: { flexDirection: "row", alignItems: "center", gap: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceCard, padding: space[4] },
  optLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  selOn: { borderColor: colors.brand, borderWidth: 2, backgroundColor: colors.brand50 },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[3], justifyContent: "center" },
  avatarCell: { width: 64, height: 64, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center" },
  footer: { flexDirection: "row", gap: space[3], padding: space[4], borderTopWidth: 1, borderTopColor: colors.hairline },
  finishCenter: { justifyContent: "center", alignItems: "center", padding: space[6], gap: space[2] },
  finishTitle: { ...type["2xl"], fontFamily: font.bold, color: colors.ink, textAlign: "center", marginTop: space[3] },
  finishSub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, textAlign: "center" },
  finishError: { ...type.sm, fontFamily: font.semibold, color: colors.danger, textAlign: "center", marginTop: space[3] },
});
