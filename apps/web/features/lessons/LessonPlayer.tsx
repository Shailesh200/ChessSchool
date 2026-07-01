"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChessBoard } from "@/features/board/ChessBoard";
import { ChessEngine } from "@/features/chess-engine/engine";
import { Mascot, type Expression } from "@/components/ui/Mascot";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Confetti } from "@/components/ui/Confetti";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";
import { useProgression, isoDay } from "@/core/store/progression.store";
import { usePlan, ROUTINE_STEPS } from "@/core/store/plan.store";
import { useSettings } from "@/core/store/settings.store";
import { useSession } from "@/core/store/session.store";
import { startNav } from "@/core/store/nav.store";
import { checkLessonAchievements } from "@/features/progression/achievements";
import { getClass, classByExamId, nextLessonAfter } from "@/features/school/structure";
import { ReflectSheet } from "@/features/journal/ReflectSheet";
import type { Lesson, LessonStep } from "./types";
import type { BoardArrow, MoveInput, Square } from "@/core/types/chess";

type Phase = "playing" | "correct" | "wrong" | "complete";

const LESSON_TIPS: Record<string, string> = {
  capture: "Scan for enemy pieces that aren't defended — you can win them for free.",
  check: "A check forces a reply. Look for the most forcing move first.",
  checkmate: "Checkmate = the king is attacked with no legal escape square.",
  mate: "Checkmate = the king is attacked with no legal escape square.",
  fork: "A knight fork hits two pieces at once — aim at the king and a big piece.",
  promotion: "Reach the last rank to promote — usually a queen, but a knight can fork!",
  opening: "In the opening: develop your pieces, control the centre, and castle early.",
};

/** The single legal move that turns fenA into fenB (the opponent's reply), or null. */
function findReply(fenA: string, fenB: string): { from: Square; to: Square } | null {
  try {
    const g = new ChessEngine(fenA);
    const target = fenB.split(" ")[0];
    for (const m of g.legalMoves()) {
      const t = g.clone();
      if (t.move({ from: m.from, to: m.to, promotion: m.promotion }) && t.fen().split(" ")[0] === target) {
        return { from: m.from as Square, to: m.to as Square };
      }
    }
  } catch {
    /* not a single-move continuation */
  }
  return null;
}

export function LessonPlayer({
  lesson,
  nextLessonId,
  lessonClass,
  schoolExam,
  homeworkStep,
  dailyPuzzle,
}: {
  lesson: Lesson;
  nextLessonId?: string | null;
  /**
   * The lesson's owning class, from the DB (so graduation works for generated
   * classes that aren't in the constants). Completing all its lessons — or
   * passing this as an exam — graduates the class.
   */
  lessonClass?: { id: string; title: string; lessonIds: string[] };
  /** when set, this is a school exam — passing unlocks the next school */
  schoolExam?: { stage: string; nextName: string };
  /** when launched from homework, which routine step to check off on completion */
  homeworkStep?: string;
  /** when launched from the daily puzzle card */
  dailyPuzzle?: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [displayFen, setDisplayFen] = useState<string | undefined>(lesson.steps[0]?.fen);
  const [correctCount, setCorrectCount] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const [observeDone, setObserveDone] = useState(false);
  const [graduatedTitle, setGraduatedTitle] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [movedTo, setMovedTo] = useState<Square | null>(null);
  const [oppMove, setOppMove] = useState<{ from: Square; to: Square } | null>(null);
  const correctRef = useRef(0); // synchronous correct count (auto-advance reads it fresh)
  const wrongRef = useRef(0); // wrong moves this attempt → report-card scoring
  const [finalMistakes, setFinalMistakes] = useState(0);
  const timers = useRef<number[]>([]);

  const progression = useProgression();
  const sound = useSettings((s) => s.sound);
  const toggleSetting = useSettings((s) => s.toggle);
  const step = lesson.steps[index] as LessonStep | undefined;
  const total = lesson.steps.length;

  // Reset per-step state during render when the step changes.
  if (index !== prevIndex) {
    setPrevIndex(index);
    setDisplayFen(step?.fen);
    setObserveDone(false);
    setPromoted(null);
    setHintLevel(0);
    setMovedTo(null);
    setOppMove(null);
  }

  // Auto-play "observe" steps move-by-move.
  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (!step || step.kind !== "observe" || !step.fen || !step.moves) {
      return;
    }
    // observeDone + displayFen are already reset during render on step change.
    const engine = new ChessEngine(step.fen);
    step.moves.forEach((mv, i) => {
      const t = window.setTimeout(
        () => {
          const [from, to] = mv.split(":");
          const applied = engine.move({ from: from!, to: to!, promotion: "q" });
          setDisplayFen(engine.fen());
          if (applied) audio.play(applied.captured ? "capture" : "move");
          if (i === step.moves!.length - 1) setObserveDone(true);
        },
        900 * (i + 1),
      );
      timers.current.push(t);
    });
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, [index, step]);

  if (!step) return null;

  const expression: Expression =
    phase === "correct" ? "cheer" : phase === "wrong" ? "sad" : step.kind === "move" ? "think" : "happy";

  function advance() {
    if (index + 1 >= total) finish();
    else {
      setIndex((i) => i + 1);
      setPhase("playing");
    }
  }

  // Check off the homework on completion: the specific routine step when launched
  // from homework, otherwise the generic lesson/practice steps.
  function markHomeworkDone() {
    const day = isoDay();
    if (homeworkStep) {
      usePlan.getState().markActivity(homeworkStep, day);
    } else {
      usePlan.getState().markActivity("lesson", day);
      usePlan.getState().markActivity("practice", day);
    }
  }

  function finish() {
    // Tutorials (no puzzles to solve) just mark done and flow to the next lesson —
    // no "lesson complete" celebration screen.
    const isTutorial = !lesson.steps.some((s) => s.kind === "move");
    if (isTutorial) {
      progression.recordLesson(lesson.id, 1, 1); // counts as completed
      progression.awardXp(lesson.xp);
      progression.registerActivity(isoDay());
      markHomeworkDone();
      if (dailyPuzzle) progression.markDailyPuzzleDone();
      const nextId = nextLessonId !== undefined ? nextLessonId : nextLessonAfter(lesson.id);
      startNav();
      router.push(nextId ? `/lesson/${nextId}` : "/");
      return;
    }
    setPhase("complete");
    const interactive = lesson.steps.filter((s) => s.kind === "move").length || 1;
    const correct = correctRef.current; // fresh count (state may lag the auto-advance)
    setFinalMistakes(wrongRef.current);
    const ratio = correct / interactive;
    progression.recordLesson(lesson.id, correct, interactive, wrongRef.current);
    progression.awardXp(lesson.xp);
    progression.registerActivity(isoDay());
    markHomeworkDone();
    if (dailyPuzzle) progression.markDailyPuzzleDone();
    const st = useProgression.getState();
    checkLessonAchievements(lesson.id, {
      mastered: Object.values(st.lessons).filter((l) => l.mastery >= 0.9).length,
      perfect: wrongRef.current === 0 && correct === interactive,
      xp: st.xp,
      streak: st.streak,
    }).forEach((id) => progression.unlockAchievement(id));

    // School exam: passing unlocks the next school (no class to graduate).
    if (schoolExam) {
      if (ratio >= 0.67) {
        progression.passSchoolExam(schoolExam.stage);
        setGraduatedTitle(`${schoolExam.nextName} unlocked!`);
        audio.play("graduation");
      } else {
        audio.play("fail");
      }
      return;
    }

    // Resolve the lesson's class — prefer the DB-passed class (works for
    // generated classes); fall back to the constants for older callers.
    const dbClass = lessonClass ?? null;
    const constCls = !dbClass ? getClass(lesson.unit) ?? classByExamId(lesson.id) : null;
    const cls = dbClass ?? (constCls ? { id: constCls.id, title: constCls.title, lessonIds: constCls.lessonIds } : null);

    // Exam: passing graduates the whole class.
    if (lesson.exam && ratio >= 0.67 && cls) {
      cls.lessonIds.forEach((id) => progression.recordLesson(id, 1, 1));
      progression.graduateClass(cls.id);
      setGraduatedTitle(cls.title);
      audio.play("graduation");
      return;
    }

    // Normal lesson: did finishing it complete (graduate) the whole class?
    if (cls && !progression.graduatedClasses.includes(cls.id)) {
      const records = useProgression.getState().lessons;
      const allMastered = cls.lessonIds.length > 0 && cls.lessonIds.every((id) => (records[id]?.mastery ?? 0) >= 0.9);
      if (allMastered) {
        progression.graduateClass(cls.id);
        setGraduatedTitle(cls.title);
        audio.play("graduation");
        return;
      }
    }
    audio.play("levelup");
    haptics.fire("success");
  }

  function handleMove(move: MoveInput): boolean {
    if (!step?.fen || phase !== "playing") return false;
    const engine = new ChessEngine(step.fen);
    const applied = engine.move(move);
    if (!applied) return false;
    const key = `${move.from}:${move.to}`;
    if (step.solution?.includes(key)) {
      correctRef.current += 1;
      setDisplayFen(engine.fen());
      setCorrectCount(correctRef.current);
      setPromoted(applied.promotion ?? null);
      setMovedTo(move.to as Square);
      setPhase("correct");
      audio.play(applied.captured ? "capture" : "success");
      haptics.fire("success");
      // If the next step continues this position (opponent replied), animate that
      // reply so the player sees what changed before their next move (#multistep).
      const next = lesson.steps[index + 1] as LessonStep | undefined;
      const reply = next?.kind === "move" && next.fen ? findReply(engine.fen(), next.fen) : null;
      if (reply && next?.fen) {
        timers.current.push(
          window.setTimeout(() => {
            setMovedTo(null);
            setOppMove(reply);
            setDisplayFen(next.fen); // board animates the opponent's reply
            audio.play("move");
          }, 850),
        );
        timers.current.push(window.setTimeout(() => advance(), 1850));
      } else {
        // Flash the square green, then auto-advance — no "tap to continue".
        timers.current.push(window.setTimeout(() => advance(), 950));
      }
      return true;
    }
    // Wrong but legal: let the move play so the user sees it, flag it red, then
    // revert the position so they can try again.
    setDisplayFen(engine.fen());
    setMovedTo(move.to as Square);
    setPhase("wrong");
    wrongRef.current += 1;
    audio.play("fail");
    haptics.fire("error");
    if (step.tag) progression.recordWeakness(step.tag);
    if (step.fen && step.solution?.[0]) {
      progression.logMistake({
        fen: step.fen,
        played: `${move.from}:${move.to}`,
        best: step.solution[0],
        tag: step.tag ?? "",
        at: Date.now(),
      });
    }
    timers.current.push(
      window.setTimeout(() => {
        setDisplayFen(step.fen);
        setMovedTo(null);
        setPhase("playing");
      }, 1300),
    );
    return true; // keep the piece on the board; we control it via displayFen
  }

  const PROMO_NAMES: Record<string, string> = { q: "queen", r: "rook", b: "bishop", n: "knight" };
  const feedbackText =
    phase === "correct"
      ? promoted
        ? `Promoted to a ${PROMO_NAMES[promoted] ?? "piece"}! A powerful new piece.`
        : (step.successText ?? "Nice work!")
      : phase === "wrong"
        ? (step.failText ?? "Not quite — try again!")
        : step.coach;

  if (phase === "complete") {
    return (
      <LessonComplete
        lesson={lesson}
        correct={correctCount}
        mistakes={finalMistakes}
        graduatedTitle={graduatedTitle}
        nextLessonId={nextLessonId}
        homeworkStep={homeworkStep}
        onDone={() => router.push("/")}
      />
    );
  }

  const isObserving = step.kind === "observe" && !observeDone;
  const solvable = step.kind === "move" && phase === "playing";
  const toMove: "w" | "b" | null =
    step.kind === "move" && step.fen ? (new ChessEngine(step.fen).turn() as "w" | "b") : null;
  // Two-stage hint: 1 = highlight the piece to move, 2 = also show the arrow.
  const hintFrom: Square | null =
    hintLevel >= 1 && solvable && step.solution?.[0] ? (step.solution[0].split(":")[0] as Square) : null;
  const hintArrows: BoardArrow[] =
    hintLevel >= 2 && solvable && step.solution?.[0]
      ? [
          {
            startSquare: step.solution[0].split(":")[0] as Square,
            endSquare: step.solution[0].split(":")[1] as Square,
            color: "#f59e0b",
          },
        ]
      : [];

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <div className="pt-safe sticky top-0 z-20 bg-surface/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button
            onClick={() => { startNav(); router.push("/"); }}
            aria-label="Back to campus"
            className="btn-tactile flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-card text-ink-700 [box-shadow:var(--shadow-card)] hover:text-brand"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <ProgressBar value={index + (phase === "correct" ? 1 : 0)} max={total} tone="success" className="flex-1" />
          <span className="text-xs font-bold text-ink-500">
            {index + 1}/{total}
          </span>
          <button
            onClick={() => {
              audio.unlock(); // resume the audio context (fixes "no sound" after idle)
              toggleSetting("sound");
              if (!sound) audio.play("notify");
            }}
            aria-label={sound ? "Mute sounds" : "Unmute sounds"}
            aria-pressed={sound}
            className="btn-tactile flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-card text-ink-700 [box-shadow:var(--shadow-card)]"
          >
            {sound ? "🔊" : "🔇"}
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-4 px-4 py-4">
        <div className="flex h-[4.75rem] items-center gap-2">
          <Mascot expression={expression} size={100} float={false} className="-my-3 shrink-0" />
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex h-[4.25rem] flex-1 items-center overflow-hidden rounded-2xl rounded-bl-sm border border-hairline bg-surface-card px-4 text-sm font-semibold text-ink [box-shadow:var(--shadow-card)]"
          >
            <span className="line-clamp-3">{feedbackText}</span>
            {lesson.exam && (
              <span className="ml-1 shrink-0 rounded-pill bg-warning/20 px-1.5 py-0.5 text-[10px] font-extrabold text-warning">
                EXAM
              </span>
            )}
          </motion.div>
        </div>

        {step.fen && (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* Viewport-based size = never re-measured, so the board cannot
                resize/flicker when the feedback footer or coach text changes. */}
            <div className="relative" style={{ width: "min(92vw, calc(100dvh - 15rem))", maxWidth: 460 }}>
              <ChessBoard
                key={index}
                fen={displayFen ?? step.fen}
                orientation={step.orientation ?? "white"}
                onMove={handleMove}
                arrows={phase === "playing" && !isObserving ? [...(step.arrows ?? []), ...hintArrows] : []}
                highlight={
                  phase === "playing" && !isObserving
                    ? [...(step.highlight ?? []), ...(hintFrom ? [hintFrom] : [])]
                    : []
                }
                lastMove={oppMove}
                successSquare={phase === "correct" ? movedTo : null}
                checkSquare={phase === "wrong" ? movedTo : null}
                interactive={step.kind === "move" && phase === "playing"}
              />
            </div>
          </div>
        )}

        {/* Fixed-height row so toggling its contents never shifts the board (no flicker). */}
        <div className="flex h-10 items-center justify-between gap-2">
          {toMove ? (
            <span className="flex items-center gap-2 rounded-pill bg-surface-sunken px-3 py-1.5 text-sm font-extrabold text-ink">
              <span
                className={`inline-block h-4 w-4 rounded-full border border-ink-300 ${
                  toMove === "w" ? "bg-white" : "bg-[#1c1b2e]"
                }`}
              />
              {toMove === "w" ? "White" : "Black"} to move
            </span>
          ) : (
            <span />
          )}
          {isObserving ? (
            <p className="text-center text-sm font-bold text-brand">▶ Watching the example…</p>
          ) : solvable && !lesson.exam ? (
            <button
              onClick={() => {
                setHintLevel((h) => Math.min(h + 1, 2));
                audio.play("notify");
                haptics.fire("tap");
              }}
              disabled={hintLevel >= 2}
              className="btn-tactile rounded-pill bg-surface-sunken px-4 py-1.5 text-xs font-bold text-ink-700 disabled:opacity-50"
            >
              {hintLevel === 0 ? "💡 Show a hint" : hintLevel === 1 ? "💡 Show the move" : "💡 Follow the arrow"}
            </button>
          ) : null}
        </div>

        {/* Fills the space below the board + reinforces the concept */}
        <div className="mx-auto mt-1 flex w-full max-w-xs items-start gap-2 rounded-card border border-hairline bg-surface-card/70 px-3 py-2">
          <span className="text-base leading-none">🎓</span>
          <p className="text-[11px] font-semibold leading-snug text-ink-500">
            {LESSON_TIPS[step.tag ?? ""] ?? LESSON_TIPS[lesson.tag] ?? "Take your time and calculate before you move."}
          </p>
        </div>
      </div>

      <FeedbackBar
        stepKind={step.kind}
        observeReady={step.kind !== "observe" || observeDone}
        playing={phase === "playing"}
        onContinue={advance}
      />
    </div>
  );
}

function FeedbackBar({
  stepKind,
  observeReady,
  playing,
  onContinue,
}: {
  stepKind: string;
  observeReady: boolean;
  playing: boolean;
  onContinue: () => void;
}) {
  // Move steps auto-advance (green flash) / auto-retry — the footer button is only
  // for info/observe steps that need a manual "Continue".
  const show = playing && (stepKind === "info" || (stepKind === "observe" && observeReady));

  // Always reserve the footer height so the board never resizes (no CLS / flicker).
  return (
    <div className="pb-safe sticky bottom-0 z-20 min-h-[5.25rem] px-4 pt-3">
      <AnimatePresence>
        {show && (
          <motion.div
            key="continue"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="mx-auto flex max-w-xl items-center justify-end gap-4 rounded-2xl border border-hairline bg-surface-card px-4 py-3"
          >
            <Button variant="success" onClick={onContinue} block>
              Continue
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LessonComplete({
  lesson,
  correct,
  mistakes,
  graduatedTitle,
  nextLessonId,
  homeworkStep,
  onDone,
}: {
  lesson: Lesson;
  correct: number;
  mistakes: number;
  graduatedTitle: string | null;
  nextLessonId?: string | null;
  homeworkStep?: string;
  onDone: () => void;
}) {
  const [reflectOpen, setReflectOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const authed = useSession((s) => s.authed);
  const homeworkDoneCount = usePlan((s) => s.routineDone.length);
  const isHomework = !!homeworkStep;
  const allHomeworkDone = homeworkDoneCount >= ROUTINE_STEPS.length;
  // Prefer the DB-computed next lesson; fall back to the constants graph.
  // Homework never chains into "continue learning" — it returns to the homework screen.
  const nextId = isHomework ? null : nextLessonId !== undefined ? nextLessonId : nextLessonAfter(lesson.id);
  const go = (id: string, href: string, action?: () => void) => {
    if (busy) return;
    setBusy(id);
    audio.play("transition");
    startNav();
    if (action) action();
    else router.push(href);
  };
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden bg-surface px-6 text-center">
      <Confetti count={graduatedTitle ? 40 : 28} />
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        <Mascot expression="cheer" size={140} />
      </motion.div>
      {graduatedTitle ? (
        <>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-pill bg-gold/20 px-4 py-1 text-xs font-extrabold uppercase tracking-wide text-warning"
          >
            🎓 Class graduated
          </motion.div>
          <h1 className="text-3xl font-extrabold text-ink">{graduatedTitle}</h1>
          <p className="text-sm font-semibold text-ink-500">
            You&apos;ve mastered this class. The next one is unlocked!
          </p>
        </>
      ) : isHomework ? (
        <>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-extrabold text-ink"
          >
            {allHomeworkDone ? "All homework done for today! 🎉" : "Homework done! ✅"}
          </motion.h1>
          <p className="text-sm font-semibold text-ink-500">
            {allHomeworkDone
              ? "You've completed every routine today — see you tomorrow!"
              : "Nice work. Head back to finish the rest of today's homework."}
          </p>
        </>
      ) : (
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-extrabold text-ink"
        >
          {lesson.exam ? "Exam complete!" : "Lesson complete!"}
        </motion.h1>
      )}
      <div className="flex gap-3">
        <StatPill label="XP earned" value={`+${lesson.xp}`} tone="text-brand" />
        <StatPill label="Correct" value={`${correct}`} tone="text-success" />
        <StatPill label="Mistakes" value={`${mistakes}`} tone={mistakes === 0 ? "text-success" : "text-danger"} />
      </div>

      {/* Guest → enroll prompt (#2): progress is saved locally and follows you up. */}
      {authed === false && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xs rounded-card border border-brand-100 bg-brand-50 p-4 text-center"
        >
          <p className="text-sm font-extrabold text-ink">📌 Save your progress</p>
          <p className="mt-1 text-xs font-semibold text-ink-500">
            Enroll free to keep your XP and continue on any device — everything you&apos;ve done so far comes with you.
          </p>
          <Button size="sm" block className="mt-3" loading={busy === "enroll"} onClick={() => go("enroll", "/register")}>
            Enroll free
          </Button>
        </motion.div>
      )}

      <div className="mt-2 flex w-full max-w-xs flex-col items-center gap-2">
        {isHomework ? (
          allHomeworkDone ? (
            <Button size="lg" block loading={busy === "home"} onClick={() => go("home", "/", onDone)}>
              Back to academy →
            </Button>
          ) : (
            <Button size="lg" block loading={busy === "hw"} onClick={() => go("hw", "/plan")}>
              Continue your homework →
            </Button>
          )
        ) : nextId ? (
          <Button size="lg" block loading={busy === "next"} onClick={() => go("next", `/lesson/${nextId}`)}>
            Continue learning →
          </Button>
        ) : (
          <Button size="lg" block loading={busy === "home"} onClick={() => go("home", "/", onDone)}>
            Back to campus
          </Button>
        )}
        <div className="flex w-full gap-2">
          <Button variant="ghost" block onClick={() => setReflectOpen(true)}>
            📝 Reflect
          </Button>
          {!isHomework && nextId && (
            <Button variant="ghost" block loading={busy === "home"} onClick={() => go("home", "/", onDone)}>
              Back to campus
            </Button>
          )}
        </div>
      </div>
      <ReflectSheet
        open={reflectOpen}
        onClose={() => setReflectOpen(false)}
        kind={lesson.exam ? "exam" : "lesson"}
        title={lesson.title}
        summary={
          graduatedTitle
            ? `Graduated ${graduatedTitle}. Scored ${correct} correct.`
            : `Completed “${lesson.title}” with ${correct} correct.`
        }
        refId={lesson.id}
      />
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface-card px-5 py-3">
      <div className={`text-2xl font-extrabold ${tone}`}>{value}</div>
      <div className="text-xs font-semibold text-ink-500">{label}</div>
    </div>
  );
}
