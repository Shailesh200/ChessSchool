import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { Cody, type CodyExpression } from "@/Cody";
import { Button } from "@/Button";
import { Icon } from "@/Icon";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { api } from "@/api";
import { colors, font, radius, shadowCard } from "@/theme";

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
  successText?: string;
  failText?: string;
};
type Lesson = { id: string; title: string; xp: number; steps: Step[] };

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 430);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"playing" | "correct" | "wrong" | "complete">("playing");
  const [flipped, setFlipped] = useState(false);
  const [displayFen, setDisplayFen] = useState<string | undefined>();
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const correctRef = useRef(0);
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
    const ratio = correctRef.current / interactive;
    try {
      const cur = await api<Record<string, unknown>>("/api/progress");
      const { user: _u, ...snap } = cur as { user?: unknown } & Record<string, unknown>;
      const lessons = { ...((snap.lessons as Record<string, unknown>) ?? {}) };
      lessons[lesson!.id] = { mastery: ratio, attempts: 1, lastSeen: Date.now(), dueAt: Date.now() + 86400000 };
      await api("/api/progress", {
        method: "POST",
        body: { ...snap, xp: ((snap.xp as number) ?? 0) + lesson!.xp, lessons },
      });
    } catch {
      /* ignore */
    }
  }

  function onMove(from: string, to: string): boolean {
    if (!step || step.kind !== "move" || phase !== "playing") return false;
    const ok = step.solution?.includes(`${from}:${to}`) ?? false;
    if (ok) {
      haptics.success();
      sfx.play("success");
      correctRef.current += 1;
      // show the moved position
      try {
        const e = new ChessEngine(step.fen);
        e.move({ from, to, promotion: "q" });
        setLastMove({ from, to });
        setDisplayFen(e.fen());
      } catch {
        /* keep fen */
      }
      setPhase("correct");
      timers.current.push(setTimeout(advance, 750));
      return true;
    }
    haptics.error();
    sfx.play("error");
    setPhase("wrong");
    timers.current.push(setTimeout(() => setPhase("playing"), 900));
    return false;
  }

  if (phase === "complete") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Cody expression="cheer" size={140} />
          <Text style={styles.doneTitle}>Lesson complete!</Text>
          <Text style={styles.doneSub}>+{lesson.xp} XP · {correctRef.current}/{interactive} correct</Text>
          <View style={{ marginTop: 22, width: 260 }}>
            <Button label="Back to academy" variant="success" onPress={() => router.back()} />
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
  hintBar: { marginHorizontal: 16, backgroundColor: colors.surfaceCard, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", ...shadowCard },
  hintText: { fontSize: 13, fontFamily: font.semibold, color: colors.ink500 },
  bottom: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, minHeight: 64, justifyContent: "center" },
  moveCue: { textAlign: "center", fontSize: 14, fontFamily: font.semibold, color: colors.ink500 },
  doneTitle: { fontSize: 26, fontFamily: font.bold, color: colors.ink, marginTop: 16 },
  doneSub: { fontSize: 15, fontFamily: font.semibold, color: colors.ink500, marginTop: 6 },
});
