import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { Cody, type CodyExpression } from "@/Cody";
import { Button } from "@/Button";
import { BackButton } from "@/BackButton";
import { Confetti } from "@/Confetti";
import { api } from "@/api";
import { mutateProgress } from "@/progressStore";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { colors, font, radius, space, type } from "@/theme";

const STAGE_ORDER = ["elementary", "middle", "high", "university", "master"];
const STAGE_NAME: Record<string, string> = {
  elementary: "Elementary School",
  middle: "Middle School",
  high: "High School",
  university: "University",
  master: "Master Program",
};

type Step = { id: string; fen: string; solution: string[]; coach?: string };
const PASS_RATIO = 0.7;

export default function SchoolExamScreen() {
  const { stage } = useLocalSearchParams<{ stage: string }>();
  const stageId = String(stage);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 440);

  const [steps, setSteps] = useState<Step[] | null>(null);
  const [i, setI] = useState(0);
  const correctRef = useRef(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [displayFen, setDisplayFen] = useState<string | undefined>();
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api<{ steps: Step[] }>(`/api/school-exam?stage=${stageId}`).then((d) => setSteps(d.steps ?? [])).catch(() => setSteps([]));
  }, [stageId]);

  const idx = STAGE_ORDER.indexOf(stageId);
  const stageName = STAGE_NAME[stageId] ?? "School";
  const nextName = STAGE_NAME[STAGE_ORDER[idx + 1] ?? ""] ?? "the next school";

  async function recordPass() {
    await mutateProgress((snap) => {
      const passed = Array.from(new Set([...(((snap.schoolExamsPassed as string[]) ?? [])), stageId]));
      return { ...snap, schoolExamsPassed: passed, xp: ((snap.xp as number) ?? 0) + 60 };
    });
  }

  if (!steps) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View></SafeAreaView>;
  }

  if (steps.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={{ fontSize: 30 }}>📝</Text>
          <Text style={styles.doneSub}>No exam is available for this school yet.</Text>
          <View style={{ marginTop: space[4], width: 200 }}><Button label="Back to campus" variant="outline" onPress={() => router.back()} /></View>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    const need = Math.ceil(steps.length * PASS_RATIO);
    const passed = correctRef.current >= need;
    return (
      <SafeAreaView style={styles.safe}>
        {passed && <Confetti />}
        <View style={styles.center}>
          <Cody expression={passed ? "cheer" : "sad"} size={140} />
          <Text style={styles.doneTitle}>{passed ? `${stageName} Exam passed!` : "Not quite yet"}</Text>
          <Text style={styles.doneSub}>
            {correctRef.current}/{steps.length} correct · {passed ? `${nextName} unlocked 🎉` : `You need ${need} to pass — keep practicing!`}
          </Text>
          <View style={{ marginTop: space[5], width: 260, gap: space[2] }}>
            {passed ? (
              <Button label="Back to campus →" variant="success" onPress={() => router.back()} />
            ) : (
              <>
                <Button label="Try again" variant="success" onPress={() => { correctRef.current = 0; setI(0); setFeedback(null); setDone(false); }} />
                <Button label="Back to campus" variant="outline" onPress={() => router.back()} />
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const step = steps[i]!;
  const turn = step.fen.split(" ")[1] === "b" ? "Black" : "White";
  const mood: CodyExpression = feedback === "correct" ? "cheer" : feedback === "wrong" ? "sad" : "think";

  function onMove(from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean {
    if (feedback) return false;
    const e = new ChessEngine(step.fen);
    const mv = e.move({ from, to, promotion });
    if (!mv) return false; // illegal — board snaps back
    const ok = step.solution.includes(`${from}:${to}`);
    setDisplayFen(e.fen());
    setLastMove({ from, to });
    sfx.play(mv.captured ? "capture" : "move");
    if (ok) { correctRef.current += 1; haptics.success(); setTimeout(() => sfx.play("success"), 180); } else { haptics.error(); setTimeout(() => sfx.play("error"), 180); }
    setFeedback(ok ? "correct" : "wrong");
    setTimeout(() => {
      setFeedback(null);
      setDisplayFen(undefined);
      setLastMove(null);
      if (i + 1 >= steps!.length) {
        if (correctRef.current >= Math.ceil(steps!.length * PASS_RATIO)) void recordPass();
        setDone(true);
      } else setI((n) => n + 1);
    }, ok ? 900 : 1250);
    return true;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.track}><View style={[styles.fill, { width: `${((i + 1) / steps.length) * 100}%` }]} /></View>
        <Text style={styles.count}>{i + 1}/{steps.length}</Text>
      </View>

      <View style={styles.coach}>
        <Cody expression={mood} size={64} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>
            {feedback === "correct" ? "Correct! ✓" : feedback === "wrong" ? "Not the best — moving on." : (step.coach ?? `Find the best move for ${turn}.`)}
          </Text>
        </View>
      </View>

      <View style={styles.boardWrap}>
        <View style={styles.turnRow}>
          <View style={[styles.turnDot, { backgroundColor: turn === "Black" ? colors.ink : "#fff" }]} />
          <Text style={styles.turnText}>{turn} to move</Text>
        </View>
        <ChessBoard fen={displayFen ?? step.fen} size={boardSize} orientation={turn === "Black" ? "black" : "white"} onMove={onMove} interactive={!feedback} lastMove={lastMove} />
      </View>

      <View style={styles.hintBar}>
        <Text style={styles.hintText}>🎓 Take your time and calculate before you move.</Text>
      </View>

      <View style={styles.bottom}>
        {!feedback ? (
          <Text style={styles.moveCue}>Your move — tap a piece to begin</Text>
        ) : (
          <Text style={styles.moveCue}>{feedback === "correct" ? "Nice — next puzzle…" : "Moving on…"}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space[5] },
  header: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingTop: 6 },
  track: { flex: 1, height: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden" },
  fill: { height: 12, borderRadius: radius.pill, backgroundColor: colors.brand },
  count: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
  coach: { flexDirection: "row", alignItems: "flex-start", gap: space[2], paddingHorizontal: space[4], marginTop: space[4] },
  bubble: { flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.card, borderBottomLeftRadius: 4, paddingHorizontal: space[4], paddingVertical: space[3], borderWidth: 1, borderColor: colors.hairline },
  bubbleText: { ...type.base, fontFamily: font.bold, color: colors.ink },
  boardWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  turnRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space[2] },
  turnDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.ink300 },
  turnText: { fontSize: 13, fontFamily: font.bold, color: colors.ink500 },
  hintBar: { marginHorizontal: space[4], backgroundColor: colors.surfaceCard, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: space[4], alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  hintText: { fontSize: 13, fontFamily: font.semibold, color: colors.ink500, textAlign: "center" },
  bottom: { paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[2], minHeight: 52, justifyContent: "center" },
  moveCue: { textAlign: "center", fontSize: 13, fontFamily: font.semibold, color: colors.ink500 },
  doneTitle: { ...type["2xl"], fontFamily: font.bold, color: colors.ink, marginTop: space[4], textAlign: "center" },
  doneSub: { ...type.base, fontFamily: font.semibold, color: colors.ink500, marginTop: space[2], textAlign: "center" },
});
