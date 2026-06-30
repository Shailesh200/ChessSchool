import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { Cody, type CodyExpression } from "@/Cody";
import { Button } from "@/Button";
import { Icon } from "@/Icon";
import { Confetti } from "@/Confetti";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { api } from "@/api";
import { progressStore } from "@/progressStore";
import { applyLessonComplete, type Mistake } from "@/progression";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type Step = {
  id: string;
  kind: "info" | "observe" | "move";
  coach: string;
  hint?: string;
  fen?: string;
  orientation?: "white" | "black";
  solution?: string[];
  moves?: string[];
  arrows?: { startSquare: string; endSquare: string; color?: string }[];
  highlight?: string[];
  tag?: string;
  successText?: string;
  failText?: string;
};
type Lesson = { id: string; title: string; xp: number; steps: Step[] };

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 16, 470);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"playing" | "correct" | "wrong" | "complete">("playing");
  const [flipped, setFlipped] = useState(false);
  const [displayFen, setDisplayFen] = useState<string | undefined>();
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [resolvingNext, setResolvingNext] = useState(false);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const mistakesRef = useRef<Mistake[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    api<Lesson>(`/api/lesson/${id}`)
      .then((l) => {
        setLesson(l);
        setDisplayFen(l.steps[0]?.fen);
      })
      .catch(() => void 0);
    return () => timers.current.forEach(clearTimeout);
  }, [id]);

  const step = lesson?.steps[index];

  // Auto-play "observe" steps.
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!step || step.kind !== "observe" || !step.fen || !step.moves) return;
    const e = new ChessEngine(step.fen);
    setDisplayFen(step.fen);
    step.moves.forEach((mv, i) => {
      const t = setTimeout(() => {
        const [from, to] = mv.split(":");
        e.move({ from: from!, to: to!, promotion: "q" });
        setLastMove({ from: from!, to: to! });
        setDisplayFen(e.fen());
        haptics.tap();
        sfx.play("move");
      }, 800 * (i + 1));
      timers.current.push(t);
    });
  }, [index, step]);

  if (!lesson || !step) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const total = lesson.steps.length;
  const interactive = lesson.steps.filter((s) => s.kind === "move").length || 1;

  function advance() {
    if (index + 1 >= total) finish();
    else {
      setIndex((i) => i + 1);
      setPhase("playing");
      setLastMove(null);
      setDisplayFen(lesson!.steps[index + 1]?.fen);
    }
  }

  async function finish() {
    setPhase("complete");
    setResolvingNext(true);
    haptics.success();
    sfx.play("win");
    const moveSteps = lesson!.steps.filter((st) => st.kind === "move").length;
    const total = moveSteps || 1;
    const correct = moveSteps === 0 ? 1 : correctRef.current;
    try {
      const cur = await api<Record<string, unknown>>("/api/progress");
      const { user: _u, ...snap } = cur as { user?: unknown } & Record<string, unknown>;
      const next = applyLessonComplete(snap, { lessonId: lesson!.id, correct, total, mistakes: wrongRef.current, xp: lesson!.xp, logs: mistakesRef.current });
      await api("/api/progress", { method: "POST", body: next });
      progressStore.set(next);
      const rs = await api<{ complete: boolean; lessonId?: string }>("/api/next-lesson");
      if (!rs.complete && rs.lessonId && rs.lessonId !== id) setNextId(rs.lessonId);
    } catch {
      /* ignore */
    } finally {
      setResolvingNext(false);
    }
  }

  function onMove(from: string, to: string): boolean {
    if (!step || step.kind !== "move" || phase !== "playing") return false;
    const e = new ChessEngine(step.fen);
    const mv = e.move({ from, to, promotion: "q" });
    if (!mv) return false; // illegal — board snaps back
    const ok = step.solution?.includes(`${from}:${to}`) ?? false;
    // Show & animate the played move (correct OR wrong) with move/capture sound.
    setDisplayFen(e.fen());
    setLastMove({ from, to });
    sfx.play(mv.captured ? "capture" : "move");
    if (ok) {
      haptics.success();
      timers.current.push(setTimeout(() => sfx.play("success"), 160));
      correctRef.current += 1;
      setPhase("correct");
      timers.current.push(setTimeout(advance, 850));
    } else {
      haptics.error();
      timers.current.push(setTimeout(() => sfx.play("error"), 160));
      wrongRef.current += 1;
      if (step.fen) mistakesRef.current.push({ fen: step.fen, played: `${from}:${to}`, best: step.solution?.[0] ?? "", tag: step.tag ?? "tactics", at: Date.now() });
      setPhase("wrong");
      // revert to the puzzle position so they can retry
      timers.current.push(
        setTimeout(() => {
          setDisplayFen(step.fen);
          setLastMove(null);
          setPhase("playing");
        }, 1100),
      );
    }
    return true;
  }

  if (phase === "complete") {
    return (
      <SafeAreaView style={styles.safe}>
        <Confetti count={28} />
        <View style={styles.center}>
          <Cody expression="cheer" size={140} />
          <Text style={styles.doneTitle}>Lesson complete!</Text>
          <View style={styles.pills}>
            <StatPill label="XP earned" value={`+${lesson.xp}`} tone={colors.brand} />
            <StatPill label="Correct" value={`${correctRef.current}`} tone={colors.success} />
            <StatPill label="Mistakes" value={`${wrongRef.current}`} tone={wrongRef.current === 0 ? colors.success : colors.danger} />
          </View>
          <View style={{ marginTop: space[6], width: 280, gap: space[2] }}>
            {resolvingNext ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.loadingBtnText}>Saving…</Text>
              </View>
            ) : (
              <Button
                label={nextId ? "Continue learning →" : "Back to academy"}
                variant="success"
                onPress={() => (nextId ? router.replace({ pathname: "/lesson/[id]", params: { id: nextId } }) : router.back())}
              />
            )}
            <View style={{ flexDirection: "row", gap: space[2] }}>
              <View style={{ flex: 1 }}>
                <Button label="📝 Reflect" variant="outline" size="sm" onPress={() => router.replace("/journal")} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Back to campus" variant="outline" size="sm" onPress={() => router.back()} />
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const mood: CodyExpression = phase === "correct" ? "cheer" : phase === "wrong" ? "sad" : step.kind === "move" ? "think" : "happy";
  const showContinue = step.kind === "info" || step.kind === "observe";
  const feedback = phase === "wrong" ? step.failText ?? "Not quite — try again." : phase === "correct" ? step.successText ?? "Correct! 🎉" : step.coach;
  const hint = step.hint ?? "Take your time and calculate before you move.";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Top bar: back · progress · counter · flip */}
      <View style={styles.topBar}>
        <Pressable style={styles.circle} onPress={() => router.back()} hitSlop={8}>
          <View style={{ transform: [{ rotate: "180deg" }] }}>
            <Icon name="chevronRight" size={20} color={colors.ink} />
          </View>
        </Pressable>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${((index + (phase === "correct" ? 1 : 0)) / total) * 100}%` }]} />
        </View>
        <Text style={styles.counter}>
          {index + 1}/{total}
        </Text>
        <Pressable style={styles.circle} onPress={() => setFlipped((f) => !f)} hitSlop={8}>
          <Icon name="flip" size={18} color={colors.ink} />
        </Pressable>
      </View>

      {/* Coach */}
      <View style={styles.coach}>
        <Cody expression={mood} size={72} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{feedback}</Text>
        </View>
      </View>

      {/* Board fills the remaining space, centered */}
      <View style={styles.boardWrap}>
        {step.kind === "move" && phase === "playing" && (
          <View style={styles.turnRow}>
            <View style={[styles.turnDot, { backgroundColor: (displayFen ?? step.fen ?? "w").split(" ")[1] === "b" ? colors.ink : "#fff" }]} />
            <Text style={styles.turnText}>{(displayFen ?? step.fen ?? "w").split(" ")[1] === "b" ? "Black" : "White"} to move</Text>
          </View>
        )}
        <ChessBoard
          fen={displayFen ?? step.fen ?? "8/8/8/8/8/8/8/8 w - - 0 1"}
          size={boardSize}
          orientation={(step.orientation ?? "white") === "black" ? (flipped ? "white" : "black") : flipped ? "black" : "white"}
          onMove={onMove}
          interactive={step.kind === "move" && phase === "playing"}
          lastMove={lastMove}
          arrows={phase === "playing" ? step.arrows : undefined}
          highlights={phase === "playing" ? step.highlight : undefined}
        />
      </View>

      {/* Hint bar */}
      <View style={styles.hintBar}>
        <Text style={styles.hintText}>🎓 {hint}</Text>
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottom}>
        {showContinue ? (
          <Button label="Continue" variant="success" onPress={advance} />
        ) : (
          <Text style={styles.moveCue}>Your move — tap a piece to begin</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function StatPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.pill}>
      <Text style={[styles.pillValue, { color: tone }]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const CIRCLE = 44;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", ...shadowCard },
  track: { flex: 1, height: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden" },
  fill: { height: 12, borderRadius: radius.pill, backgroundColor: colors.success },
  counter: { fontFamily: font.bold, color: colors.ink500, fontSize: 15 },
  coach: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 16, marginTop: 14 },
  bubble: { flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.card, borderBottomLeftRadius: 4, paddingHorizontal: 18, paddingVertical: 16, ...shadowCard },
  bubbleText: { fontSize: 17, fontFamily: font.bold, color: colors.ink, lineHeight: 24 },
  boardWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  hintBar: { marginHorizontal: 16, backgroundColor: colors.surfaceCard, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center", ...shadowCard },
  hintText: { fontSize: 15, fontFamily: font.semibold, color: colors.ink500 },
  turnRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space[2] },
  turnDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.ink300 },
  turnText: { fontSize: 13, fontFamily: font.bold, color: colors.ink500 },
  bottom: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, minHeight: 64, justifyContent: "center" },
  moveCue: { textAlign: "center", fontSize: 14, fontFamily: font.semibold, color: colors.ink500 },
  doneTitle: { ...type["3xl"], fontFamily: font.bold, color: colors.ink, marginTop: 16 },
  pills: { flexDirection: "row", gap: space[2], marginTop: space[4] },
  pill: { backgroundColor: colors.surfaceSunken, borderRadius: radius.card, paddingVertical: space[3], paddingHorizontal: space[4], alignItems: "center", minWidth: 92 },
  pillValue: { ...type["2xl"], fontFamily: font.bold },
  pillLabel: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  loadingBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.success, borderRadius: radius.pill, paddingVertical: 15 },
  loadingBtnText: { ...type.base, fontFamily: font.bold, color: "#fff" },
});
