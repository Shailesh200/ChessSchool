import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Cody, type CodyExpression } from "@/Cody";
import { Button } from "@/Button";
import { Icon, type IconName } from "@/Icon";
import { haptics } from "@/haptics";
import { setOrientationSeen } from "@/orientationSeen";
import { useAuth } from "@/auth";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, space, type } from "@/theme";

type Step = {
  expression: CodyExpression;
  kicker: string;
  title: string;
  body: string;
  icon: IconName;
};

const STEPS: Step[] = [
  {
    expression: "wave",
    kicker: "Orientation",
    title: "ChessSchool",
    body: "A premium chess academy in your pocket — graduate through real classes, not an endless puzzle feed.",
    icon: "cap",
  },
  {
    expression: "happy",
    kicker: "Step 1",
    title: "Follow the campus map",
    body: "Unlock semesters and classes, pass exams, and earn your graduation badge — just like school.",
    icon: "learn",
  },
  {
    expression: "think",
    kicker: "Step 2",
    title: "Lessons & homework",
    body: "Coach-guided puzzles, daily goals, and a six-step homework routine keep you improving every day.",
    icon: "target",
  },
  {
    expression: "cheer",
    kicker: "Step 3",
    title: "Play & review",
    body: "Bots at your level, pass-and-play, online friends, match replay, and a journal for reflections.",
    icon: "play",
  },
  {
    expression: "happy",
    kicker: "Ready?",
    title: "Jump into the academy",
    body: "Explore lessons and play right away — enroll anytime from Profile to save progress across devices.",
    icon: "sparkle",
  },
];

/** First-run orientation — step through features, then open the academy. */
export default function OrientationScreen() {
  const router = useRouter();
  const { loading, orientationDone, enterGuestBrowse, markOrientationDone } = useAuth();
  const { colors } = useAppTheme();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading && orientationDone) router.replace("/(tabs)/academy");
  }, [loading, orientationDone, router]);

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.surface },
        inner: { flex: 1, paddingHorizontal: space[6], paddingTop: space[4], paddingBottom: space[4] },
        topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space[4] },
        stepCount: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
        skip: { ...type.sm, fontFamily: font.bold, color: colors.brand },
        track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden", marginBottom: space[6] },
        fill: { height: 10, borderRadius: radius.pill, backgroundColor: colors.brand },
        body: { flex: 1, justifyContent: "center", alignItems: "center", gap: space[4] },
        iconBadge: {
          width: 56,
          height: 56,
          borderRadius: radius.card,
          backgroundColor: colors.brand50,
          borderWidth: 1,
          borderColor: colors.brand100,
          alignItems: "center",
          justifyContent: "center",
        },
        kicker: { ...type.xs, fontFamily: font.bold, color: colors.brand, letterSpacing: 1, textTransform: "uppercase" },
        title: { ...type["2xl"], fontFamily: font.bold, color: colors.ink, textAlign: "center" },
        copy: { ...type.base, fontFamily: font.semibold, color: colors.ink500, textAlign: "center", lineHeight: 24, maxWidth: 340 },
        footer: { gap: space[3], paddingTop: space[2] },
        dots: { flexDirection: "row", justifyContent: "center", gap: space[2], marginBottom: space[2] },
        dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink300 },
        dotOn: { width: 22, backgroundColor: colors.brand },
      }),
    [colors],
  );

  async function finish() {
    await setOrientationSeen();
    markOrientationDone();
    enterGuestBrowse();
    haptics.success();
    router.replace("/(tabs)/academy");
  }

  function next() {
    haptics.tap();
    if (isLast) void finish();
    else setStep((s) => s + 1);
  }

  function back() {
    if (step === 0) return;
    haptics.tap();
    setStep((s) => s - 1);
  }

  if (loading || orientationDone) {
    return <SafeAreaView style={styles.safe} edges={["top", "bottom"]} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <Text style={styles.stepCount}>
            {step + 1} / {STEPS.length}
          </Text>
          {!isLast && (
            <Pressable onPress={() => void finish()} hitSlop={8} testID="orientation-skip">
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>

        <View style={styles.body}>
          <Cody expression={current.expression} size={120} />
          <View style={styles.iconBadge}>
            <Icon name={current.icon} size={28} color={colors.brand} duotone />
          </View>
          <Text style={styles.kicker}>{current.kicker}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.copy}>{current.body}</Text>
        </View>

        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
          ))}
        </View>

        <View style={styles.footer}>
          <View style={{ flexDirection: "row", gap: space[3] }}>
            {step > 0 && (
              <View style={{ flex: 1 }}>
                <Button label="Back" variant="outline" onPress={back} />
              </View>
            )}
            <View style={{ flex: step > 0 ? 2 : 1 }}>
              <Button label={isLast ? "Open academy →" : "Continue"} onPress={next} />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
