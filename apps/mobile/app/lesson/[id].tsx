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
import { useAuth } from "@/auth";
import { useSettings } from "@/settings";
import { FetchErrorView } from "@/FetchErrorView";
import { mutateProgress } from "@/progressStore";
import { invalidateLearnCache } from "@/useLearnData";
import { cachePeek, cacheSet } from "@/dataCache";
import { ScreenLoader } from "@/ScreenLoader";
import { ReflectSheet } from "@/ReflectSheet";
import { applyClassGraduation, applyLessonComplete, graduateClass, isoDay, type Mistake } from "@/progression";
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
type Lesson = { id: string; title: string; xp: number; steps: Step[]; classId?: string | null; exam?: boolean };
type LessonClass = { id: string; title: string; lessonIds: string[] };

const LESSON_TIPS: Record<string, string> = {
  capture: "Scan for enemy pieces that aren't defended — you can win them for free.",
  check: "A check forces a reply. Look for the most forcing move first.",
  checkmate: "Checkmate = the king is attacked with no legal escape square.",
  mate: "Checkmate = the king is attacked with no legal escape square.",
  fork: "A knight fork hits two pieces at once — aim at the king and a big piece.",
  promotion: "Reach the last rank to promote — usually a queen, but a knight can fork!",
  opening: "In the opening: develop your pieces, control the centre, and castle early.",
};

const EXAM_PASS_RATIO = 0.7;

function findReply(fenA: string, fenB: string): { from: string; to: string } | null {
  try {
    const g = new ChessEngine(fenA);
    const target = fenB.split(" ")[0];
    for (const m of g.legalMoves()) {
      const t = new ChessEngine(g.fen());
      if (t.move({ from: m.from, to: m.to, promotion: m.promotion ?? "q" }) && t.fen().split(" ")[0] === target) {
        return { from: m.from, to: m.to };
      }
    }
  } catch {
    /* not a single-move continuation */
  }
  return null;
}

export default function LessonScreen() {
  const { id, hw, daily } = useLocalSearchParams<{ id: string; hw?: string; daily?: string }>();
  const router = useRouter();
  const { guest, exitGuest } = useAuth();
  const { hints: hintsEnabled } = useSettings();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 16, 470);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lessonClass, setLessonClass] = useState<LessonClass | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"playing" | "correct" | "wrong" | "complete" | "exam-failed">("playing");
  const [flipped, setFlipped] = useState(false);
  const [displayFen, setDisplayFen] = useState<string | undefined>();
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [graduatedTitle, setGraduatedTitle] = useState<string | null>(null);
  const [resolvingNext, setResolvingNext] = useState(false);
  const [observeReady, setObserveReady] = useState(true);
  const [hintLevel, setHintLevel] = useState(0);
  const [reflectOpen, setReflectOpen] = useState(false);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const mistakesRef = useRef<Mistake[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  async function loadLesson() {
    setLoadError(false);
    const cacheKey = `lesson:${id}`;
    const cached = cachePeek<Lesson>(cacheKey);
    if (cached) {
      setLesson(cached);
      setDisplayFen(cached.steps[0]?.fen);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const l = await api<Lesson>(`/api/lesson/${id}`);
      cacheSet(cacheKey, l);
      setLesson(l);
      setDisplayFen(l.steps[0]?.fen);
      if (l.classId) {
        try {
          const cd = await api<{ class: { id: string; title: string }; lessons: { id: string }[] }>(`/api/class/${l.classId}`);
          setLessonClass({ id: cd.class.id, title: cd.class.title, lessonIds: cd.lessons.map((item) => item.id) });
        } catch {
          setLessonClass(null);
        }
      }
    } catch {
      if (!cached) {
        setLesson(null);
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLesson();
    return () => timers.current.forEach(clearTimeout);
  }, [id]);

  const step = lesson?.steps[index];

  // Auto-play "observe" steps.
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!step || step.kind !== "observe" || !step.fen || !step.moves) {
      setObserveReady(true);
      return;
    }
    setObserveReady(false);
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
        if (i === step.moves!.length - 1) setObserveReady(true);
      }, 800 * (i + 1));
      timers.current.push(t);
    });
  }, [index, step]);

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <FetchErrorView title="Lesson couldn't load" onRetry={loadLesson} onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (loading || !lesson) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenLoader label="Setting up the board…" />
      </SafeAreaView>
    );
  }

  if (!lesson.steps.length || !step) {
    return (
      <SafeAreaView style={styles.safe}>
        <FetchErrorView title="This lesson couldn't be loaded" message="The lesson has no playable steps." onRetry={loadLesson} onBack={() => router.back()} />
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
      setHintLevel(0);
      setLastMove(null);
      setDisplayFen(lesson!.steps[index + 1]?.fen);
    }
  }

  function retryExam() {
    correctRef.current = 0;
    wrongRef.current = 0;
    mistakesRef.current = [];
    setIndex(0);
    setPhase("playing");
    setHintLevel(0);
    setLastMove(null);
    setDisplayFen(lesson!.steps[0]?.fen);
    setGraduatedTitle(null);
    setNextId(null);
  }

  async function finish() {
    const moveSteps = lesson!.steps.filter((st) => st.kind === "move").length;
    const totalMoves = moveSteps || 1;
    const correct = moveSteps === 0 ? 1 : Math.max(0, moveSteps - wrongRef.current);
    const ratio = correct / totalMoves;

    if (lesson!.exam && ratio < EXAM_PASS_RATIO) {
      setPhase("exam-failed");
      haptics.error();
      sfx.play("error");
      return;
    }

    setPhase("complete");
    setResolvingNext(true);
    haptics.success();
    sfx.play("win");
    let completedClassTitle: string | null = null;
    try {
      await mutateProgress((snap) => {
        let next = applyLessonComplete(snap, { lessonId: lesson!.id, correct, total: totalMoves, mistakes: wrongRef.current, xp: lesson!.xp, logs: mistakesRef.current });
        if (hw) {
          const today = isoDay();
          const hd = { ...((next.homeworkDone as Record<string, string[]>) ?? {}) };
          hd[today] = Array.from(new Set([...(hd[today] ?? []), hw]));
          next = { ...next, homeworkDone: hd };
        }
        if (daily === "1") {
          next = { ...next, dailyPuzzleDay: isoDay() };
        }
        if (lesson!.exam && ratio >= EXAM_PASS_RATIO && lessonClass) {
          next = applyClassGraduation(next, { classId: lessonClass.id, lessonIds: lessonClass.lessonIds });
          completedClassTitle = lessonClass.title;
        } else if (lessonClass && !((next.graduatedClasses as string[] | undefined) ?? []).includes(lessonClass.id)) {
          const records = (next.lessons as Record<string, { mastery: number }> | undefined) ?? {};
          const allMastered = lessonClass.lessonIds.length > 0 && lessonClass.lessonIds.every((lessonId) => (records[lessonId]?.mastery ?? 0) >= 0.9);
          if (allMastered) {
            next = graduateClass(next, lessonClass.id);
            completedClassTitle = lessonClass.title;
          }
        }
        return next;
      });
      invalidateLearnCache();
      setGraduatedTitle(completedClassTitle);
      const rs = await api<{ complete: boolean; lessonId?: string }>("/api/next-lesson");
      if (!rs.complete && rs.lessonId && rs.lessonId !== id) setNextId(rs.lessonId);
    } catch {
      /* ignore */
    } finally {
      setResolvingNext(false);
    }
  }

  function onMove(from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean {
    if (!step || step.kind !== "move" || phase !== "playing") return false;
    const e = new ChessEngine(step.fen);
    const mv = e.move({ from, to, promotion });
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
      const next = lesson!.steps[index + 1];
      const reply = next?.kind === "move" && next.fen ? findReply(e.fen(), next.fen) : null;
      if (reply && next?.fen) {
        timers.current.push(
          setTimeout(() => {
            setLastMove(reply);
            setDisplayFen(next.fen);
            sfx.play("move");
          }, 850),
        );
        timers.current.push(setTimeout(advance, 1850));
      } else {
        timers.current.push(setTimeout(advance, 850));
      }
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

  if (phase === "exam-failed") {
    const moveSteps = lesson.steps.filter((st) => st.kind === "move").length || 1;
    const correct = Math.max(0, moveSteps - wrongRef.current);
    const need = Math.ceil(moveSteps * EXAM_PASS_RATIO);
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Cody expression="sad" size={140} />
          <Text style={styles.doneTitle}>Not quite yet</Text>
          <Text style={styles.doneSub}>
            {correct}/{moveSteps} correct — you need {need} ({Math.round(EXAM_PASS_RATIO * 100)}%) to pass. Review the class and try again!
          </Text>
          <View style={styles.pills}>
            <StatPill label="Correct" value={`${correct}`} tone={colors.success} />
            <StatPill label="Mistakes" value={`${wrongRef.current}`} tone={colors.danger} />
            <StatPill label="To pass" value={`${need}+`} tone={colors.brand} />
          </View>
          <View style={{ marginTop: space[6], width: 280, gap: space[2] }}>
            <Button label="Try again →" variant="success" onPress={retryExam} />
            <Button label="Back to campus" variant="outline" size="sm" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "complete") {
    return (
      <SafeAreaView style={styles.safe}>
        <Confetti count={28} />
        <View style={styles.center}>
          <Cody expression="cheer" size={140} />
          <Text style={styles.doneTitle}>{graduatedTitle ? "Class graduated! 🎓" : lesson.exam ? "Exam complete!" : hw ? "Homework done! 🎉" : "Lesson complete!"}</Text>
          {graduatedTitle ? <Text style={styles.doneSub}>{graduatedTitle} is now complete.</Text> : hw && <Text style={styles.doneSub}>One step done — keep going to finish today's set.</Text>}
          <View style={styles.pills}>
            <StatPill label="XP earned" value={`+${lesson.xp}`} tone={colors.brand} />
            <StatPill label="Correct" value={`${correctRef.current}`} tone={colors.success} />
            <StatPill label="Mistakes" value={`${wrongRef.current}`} tone={wrongRef.current === 0 ? colors.success : colors.danger} />
          </View>
          {guest && (
            <View style={styles.enrollCard}>
              <Text style={styles.enrollTitle}>Save your progress</Text>
              <Text style={styles.enrollCopy}>Enroll to keep this lesson, your streak, journal, homework, and badges across devices.</Text>
              <Button
                label="Log in or enroll →"
                size="sm"
                onPress={() => {
                  exitGuest();
                  router.push("/login");
                }}
              />
            </View>
          )}
          <View style={{ marginTop: space[6], width: 280, gap: space[2] }}>
            {resolvingNext ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.loadingBtnText}>Saving…</Text>
              </View>
            ) : hw ? (
              <Button label="Back to homework →" variant="success" onPress={() => router.back()} />
            ) : (
              <Button
                label="Continue learning →"
                variant="success"
                onPress={() => (nextId ? router.replace({ pathname: "/lesson/[id]", params: { id: nextId } }) : router.back())}
              />
            )}
            <View style={{ flexDirection: "row", gap: space[2], alignItems: "stretch" }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Button label="📝 Reflect" variant="outline" size="sm" onPress={() => setReflectOpen(true)} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Button label="Back to campus" variant="outline" size="sm" onPress={() => router.back()} />
              </View>
            </View>
          </View>
        </View>
        <ReflectSheet
          visible={reflectOpen}
          onClose={() => setReflectOpen(false)}
          kind={lesson.exam ? "exam" : "lesson"}
          title={lesson.title}
          summary={`+${lesson.xp} XP · ${correctRef.current} correct · ${wrongRef.current} mistakes`}
          refId={lesson.id}
        />
      </SafeAreaView>
    );
  }

  const mood: CodyExpression = phase === "correct" ? "cheer" : phase === "wrong" ? "sad" : step.kind === "move" ? "think" : "happy";
  const showContinue = step.kind === "info" || step.kind === "observe";
  const feedback = phase === "wrong" ? step.failText ?? "Not quite — try again." : phase === "correct" ? step.successText ?? "Correct! 🎉" : step.coach;
  const tagTip = step.tag ? LESSON_TIPS[step.tag] : undefined;
  const hint = step.hint ?? tagTip ?? "Take your time and calculate before you move.";
  const solvable = step.kind === "move" && phase === "playing" && !lesson.exam;
  const hintFrom = hintLevel >= 1 && solvable && step.solution?.[0] ? step.solution[0].split(":")[0] : null;
  const hintArrows =
    hintLevel >= 2 && solvable && step.solution?.[0]
      ? [{ startSquare: step.solution[0].split(":")[0]!, endSquare: step.solution[0].split(":")[1]!, color: colors.warning }]
      : step.arrows;
  const hintHighlights = hintFrom ? [...(step.highlight ?? []), hintFrom] : step.highlight;

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
          arrows={phase === "playing" ? hintArrows : undefined}
          highlights={phase === "playing" ? hintHighlights : undefined}
          successSquare={phase === "correct" ? lastMove?.to ?? null : null}
          checkSquare={phase === "wrong" ? lastMove?.to ?? null : null}
        />
      </View>

      {/* Hint bar */}
      <View style={styles.hintBar}>
        <Text style={styles.hintText}>🎓 {hint}</Text>
        {hintsEnabled && solvable && (
          <Pressable
            style={styles.hintBtn}
            onPress={() => setHintLevel((h) => Math.min(2, h + 1))}
          >
            <Text style={styles.hintBtnText}>
              {hintLevel === 0 ? "💡 Show a hint" : hintLevel === 1 ? "💡 Show the move" : "💡 Follow the arrow"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottom}>
        {showContinue ? (
          <Button label={step.kind === "observe" && !observeReady ? "Watching…" : "Continue"} variant="success" onPress={() => { if (step.kind !== "observe" || observeReady) advance(); }} />
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
  hintBar: { marginHorizontal: 16, backgroundColor: colors.surfaceCard, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center", gap: space[2], ...shadowCard },
  hintText: { fontSize: 15, fontFamily: font.semibold, color: colors.ink500, textAlign: "center" },
  hintBtn: { borderRadius: radius.pill, backgroundColor: colors.brand50, paddingHorizontal: space[4], paddingVertical: space[2] },
  hintBtnText: { ...type.xs, fontFamily: font.bold, color: colors.brand },
  turnRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space[2] },
  turnDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.ink300 },
  turnText: { fontSize: 13, fontFamily: font.bold, color: colors.ink500 },
  bottom: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, minHeight: 64, justifyContent: "center" },
  moveCue: { textAlign: "center", fontSize: 14, fontFamily: font.semibold, color: colors.ink500 },
  doneTitle: { ...type["3xl"], fontFamily: font.bold, color: colors.ink, marginTop: 16 },
  doneSub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: 6, textAlign: "center" },
  pills: { flexDirection: "row", gap: space[2], marginTop: space[4] },
  enrollCard: { width: 280, marginTop: space[4], backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand100, borderRadius: radius.card, padding: space[4], gap: space[2] },
  enrollTitle: { ...type.base, fontFamily: font.bold, color: colors.ink },
  enrollCopy: { ...type.sm, fontFamily: font.medium, color: colors.ink500, lineHeight: 20, textAlign: "center" },
  pill: { backgroundColor: colors.surfaceSunken, borderRadius: radius.card, paddingVertical: space[3], paddingHorizontal: space[4], alignItems: "center", minWidth: 92 },
  pillValue: { ...type["2xl"], fontFamily: font.bold },
  pillLabel: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  loadingBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.success, borderRadius: radius.pill, paddingVertical: 15 },
  loadingBtnText: { ...type.base, fontFamily: font.bold, color: "#fff" },
});
