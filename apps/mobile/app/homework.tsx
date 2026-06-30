import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { settings, useSettings } from "@/settings";
import { useProgress, mutateProgress } from "@/progressStore";
import { isoDay } from "@/progression";
import { TopBar } from "@/TopBar";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { Slider } from "@/Slider";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type PlanTier = "casual" | "standard" | "serious" | "competitive" | "custom";
const PLAN_SPECS: Record<PlanTier, { label: string; minutes: string; lessonsPerDay: number; goalXp: number; blurb: string; emoji: string }> = {
  casual: { label: "Casual", minutes: "10–15 min", lessonsPerDay: 1, goalXp: 30, blurb: "A relaxed pace — keep the habit alive.", emoji: "🌱" },
  standard: { label: "Standard", minutes: "20–30 min", lessonsPerDay: 2, goalXp: 50, blurb: "Steady, balanced improvement.", emoji: "📘" },
  serious: { label: "Serious", minutes: "45–60 min", lessonsPerDay: 3, goalXp: 80, blurb: "Real, measurable progress.", emoji: "🔥" },
  competitive: { label: "Competitive", minutes: "90+ min", lessonsPerDay: 5, goalXp: 130, blurb: "Tournament-ready training load.", emoji: "🏆" },
  custom: { label: "Custom", minutes: "your call", lessonsPerDay: 2, goalXp: 60, blurb: "Set your own daily target.", emoji: "⚙️" },
};
const TIERS = Object.keys(PLAN_SPECS) as PlanTier[];
const ROUTINE = [
  { id: "warmup", label: "Warmup", emoji: "🤸" },
  { id: "lesson", label: "Lesson", emoji: "📖" },
  { id: "practice", label: "Guided practice", emoji: "🎯" },
  { id: "match", label: "Play a match", emoji: "♟️" },
  { id: "review", label: "Review", emoji: "🔍" },
  { id: "reflection", label: "Reflection", emoji: "📝" },
] as const;
const SCHEDULES = [
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekends", label: "Weekends" },
] as const;

type Hw = { id: string; title: string; tag: string };

export default function PlanScreen() {
  const router = useRouter();
  const s = useSettings();
  const prog = useProgress();
  const p = {
    today: ((prog?.activityDays as Record<string, number>) ?? {})[isoDay()] ?? 0,
    streak: (prog?.streak as number) ?? 0,
    homeworkStreak: (prog?.homeworkStreak as number) ?? 0,
  };
  const [byType, setByType] = useState<Record<string, Hw[]>>({});

  useEffect(() => {
    api<{ byType: Record<string, Hw[]> }>("/api/homework").then((d) => setByType(d.byType ?? {})).catch(() => void 0);
  }, []);

  const goal = s.planTier === "custom" ? s.customGoalXp : PLAN_SPECS[s.planTier].goalXp;
  const todayXp = Math.min(p.today, goal);

  async function setTier(tier: PlanTier) {
    settings.set("planTier", tier);
    await mutateProgress((snap) => ({ ...snap, dailyGoalXp: PLAN_SPECS[tier].goalXp }));
  }

  const dayIndex = Math.floor(Date.now() / 86400000);
  const doneToday = ((prog?.homeworkDone as Record<string, string[]>) ?? {})[isoDay()] ?? [];
  const allDone = ROUTINE.every((r) => doneToday.includes(r.id));
  const openRoutine = (id: string) => {
    if (id === "match") return router.push("/play");
    const pool = byType[id] ?? [];
    if (pool.length) router.push({ pathname: "/lesson/[id]", params: { id: pool[dayIndex % pool.length]!.id, hw: id } });
    else router.push("/play");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.h1}>Homework</Text>
        </View>

        {/* Today's goal */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.goalTitle}>🎯 Today's goal</Text>
            <Text style={styles.muted}>{todayXp}/{goal} XP</Text>
          </View>
          <View style={[styles.track, { marginTop: space[2] }]}>
            <View style={[styles.fill, { backgroundColor: colors.gold, width: `${Math.min(100, (todayXp / goal) * 100)}%` }]} />
          </View>
          <View style={styles.chipsRow}>
            <Text style={[styles.chip, { backgroundColor: "rgba(255,122,89,0.1)", color: colors.accent600 }]}>🔥 {p.streak}-day streak</Text>
            <Text style={styles.chip}>{todayXp >= goal ? "Goal reached — well done! 🎉" : `${goal - todayXp} XP to go`}</Text>
          </View>
        </View>

        {/* Pace */}
        <View>
          <Text style={styles.h2}>Choose your pace</Text>
          <View style={styles.paceGrid}>
            {TIERS.map((tier) => {
              const spec = PLAN_SPECS[tier];
              const on = s.planTier === tier;
              return (
                <Pressable key={tier} testID={`pace-${tier}`} style={[styles.pace, on && styles.selOn]} onPress={() => setTier(tier)}>
                  <Text style={{ fontSize: 20 }}>{spec.emoji}</Text>
                  <Text style={styles.paceLabel}>{spec.label}</Text>
                  <Text style={styles.paceMin}>{spec.minutes}/day</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.paceBlurb}>{PLAN_SPECS[s.planTier].blurb} · Goal: {goal} XP/day · {PLAN_SPECS[s.planTier].lessonsPerDay} lessons</Text>
          {s.planTier === "custom" && (
            <View style={{ marginTop: space[3] }}>
              <View style={styles.rowBetween}>
                <Text style={styles.goalTitle}>Daily XP goal</Text>
                <Text style={styles.muted}>{s.customGoalXp} XP</Text>
              </View>
              <View style={{ marginTop: space[2] }}>
                <Slider value={s.customGoalXp} min={10} max={200} step={10} onChange={(v) => settings.set("customGoalXp", v)} />
              </View>
            </View>
          )}
        </View>

        {/* Schedule */}
        <View>
          <Text style={styles.h2}>When do you study?</Text>
          <View style={styles.pills}>
            {SCHEDULES.map((sc) => {
              const on = s.schedule === sc.id;
              return (
                <Pressable key={sc.id} style={[styles.pill, on && styles.pillOn]} onPress={() => settings.set("schedule", sc.id)}>
                  <Text style={[styles.pillText, on && styles.pillTextOn]}>{sc.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Today's homework routine */}
        <View>
          <View style={styles.rowBetween}>
            <Text style={styles.h2}>Today's homework</Text>
            <Text style={styles.muted}>{doneToday.length}/{ROUTINE.length} · 🔥 {p.homeworkStreak}d</Text>
          </View>
          {allDone && (
            <View style={styles.doneBanner}>
              <Text style={styles.doneBannerText}>🎉 All done for today — come back tomorrow for a fresh set!</Text>
            </View>
          )}
          <View style={styles.card}>
            {ROUTINE.map((step, i) => {
              const hw = byType[step.id]?.[dayIndex % (byType[step.id]?.length || 1)];
              const label = hw ? `${step.label}: ${hw.title.replace(/^.*?: /, "")}` : step.label;
              const checked = doneToday.includes(step.id);
              return (
                <View key={step.id} testID={`routine-${step.id}`} style={[styles.routineRow, i > 0 && styles.routineDivider]}>
                  <View style={[styles.checkbox, checked && styles.checkboxOn]}>{checked && <Text style={styles.checkmark}>✓</Text>}</View>
                  <Text style={{ fontSize: 18 }}>{step.emoji}</Text>
                  <Text style={[styles.routineLabel, checked && styles.routineLabelDone]} numberOfLines={1}>{label}</Text>
                  <Pressable style={[styles.goBtn, checked && styles.goBtnDone]} onPress={() => openRoutine(step.id)} hitSlop={6}>
                    <Text style={[styles.goText, checked && { color: colors.ink500 }]}>{checked ? "Redo" : "Go →"}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          {!allDone && (
            <View style={{ marginTop: space[3] }}>
              <Button label="Start today's homework →" onPress={() => openRoutine(ROUTINE.find((r) => !doneToday.includes(r.id))?.id ?? "warmup")} />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space[5], gap: space[5], paddingBottom: 40 },
  header: { gap: space[2] },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  h2: { ...type.sm, fontFamily: font.bold, color: colors.ink, marginBottom: space[2] },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  muted: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden" },
  fill: { height: 10, borderRadius: radius.pill },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] },
  chip: { ...type.xs, fontFamily: font.bold, color: colors.ink700, backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: space[1], overflow: "hidden" },
  paceGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  pace: { width: "48.5%", backgroundColor: colors.surfaceCard, borderRadius: radius.md, padding: space[3], borderWidth: 1, borderColor: colors.hairline, ...shadowCard },
  selOn: { borderColor: colors.brand, borderWidth: 2 },
  paceLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink, marginTop: space[1] },
  paceMin: { ...type.caption, fontFamily: font.semibold, color: colors.ink500 },
  paceBlurb: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: space[2] },
  pills: { flexDirection: "row", gap: space[2] },
  pill: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, alignItems: "center" },
  pillOn: { backgroundColor: colors.brand },
  pillText: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
  pillTextOn: { color: "#fff" },
  routineRow: { flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3] },
  routineDivider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.ink300, justifyContent: "center", alignItems: "center" },
  checkboxOn: { backgroundColor: colors.success, borderColor: colors.success },
  checkmark: { color: "#fff", fontSize: 13, fontFamily: font.bold },
  routineLabel: { flex: 1, ...type.sm, fontFamily: font.bold, color: colors.ink },
  routineLabelDone: { color: colors.ink500, textDecorationLine: "line-through" },
  goBtn: { borderRadius: radius.pill, backgroundColor: colors.brand, paddingHorizontal: space[3], paddingVertical: 6 },
  goBtnDone: { backgroundColor: colors.surfaceSunken },
  goText: { ...type.xs, fontFamily: font.bold, color: "#fff" },
  doneBanner: { backgroundColor: "#e7f7ef", borderRadius: radius.card, padding: space[3], marginTop: space[2], borderWidth: 1, borderColor: "rgba(12,155,110,0.3)" },
  doneBannerText: { ...type.sm, fontFamily: font.bold, color: colors.success600, textAlign: "center" },
});
