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
import { useSession } from "@/core/store/session.store";
import { startNav } from "@/core/store/nav.store";
import { useSquareSize } from "@/core/hooks/useSquareSize";
import { checkLessonAchievements } from "@/features/progression/achievements";
import { getClass, classByExamId, nextLessonAfter } from "@/features/school/structure";
import { ReflectSheet } from "@/features/journal/ReflectSheet";
import type { Lesson, LessonStep } from "./types";
import type { MoveInput } from "@/core/types/chess";

type Phase = "playing" | "correct" | "wrong" | "complete";

export function LessonPlayer({
  lesson,
  nextLessonId,
  lessonClass,
}: {
  lesson: Lesson;
  nextLessonId?: string | null;
  /**
   * The lesson's owning class, from the DB (so graduation works for generated
   * classes that aren't in the constants). Completing all its lessons — or
   * passing this as an exam — graduates the class.
   */
  lessonClass?: { id: string; title: string; lessonIds: string[] };
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [displayFen, setDisplayFen] = useState<string | undefined>(lesson.steps[0]?.fen);
  const [correctCount, setCorrectCount] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const [observeDone, setObserveDone] = useState(false);
  const [graduatedTitle, setGraduatedTitle] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const [boardBox, boardSize] = useSquareSize();

  const progression = useProgression();
  const step = lesson.steps[index] as LessonStep | undefined;
  const total = lesson.steps.length;

  // Reset per-step state during render when the step changes.
  if (index !== prevIndex) {
    setPrevIndex(index);
    setDisplayFen(step?.fen);
    setObserveDone(false);
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

  function finish() {
    setPhase("complete");
    const interactive = lesson.steps.filter((s) => s.kind === "move").length || 1;
    const ratio = correctCount / interactive;
    progression.recordLesson(lesson.id, correctCount, interactive);
    progression.awardXp(lesson.xp);
    progression.registerActivity(isoDay());
    checkLessonAchievements(lesson.id, {
      mastered: Object.keys(progression.lessons).length + 1,
    }).forEach((id) => progression.unlockAchievement(id));

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
      setDisplayFen(engine.fen());
      setCorrectCount((c) => c + 1);
      setPhase("correct");
      audio.play(applied.captured ? "capture" : "success");
      haptics.fire("success");
      return true;
    }
    setPhase("wrong");
    audio.play("fail");
    haptics.fire("error");
    if (step.tag) progression.recordWeakness(step.tag);
    return false;
  }

  const feedbackText =
    phase === "correct"
      ? (step.successText ?? "Nice work!")
      : phase === "wrong"
        ? (step.failText ?? "Not quite — try again!")
        : step.coach;

  if (phase === "complete") {
    return (
      <LessonComplete
        lesson={lesson}
        correct={correctCount}
        graduatedTitle={graduatedTitle}
        nextLessonId={nextLessonId}
        onDone={() => router.push("/")}
      />
    );
  }

  const isObserving = step.kind === "observe" && !observeDone;

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
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-4 px-4 py-4">
        <div className="flex min-h-[5rem] items-end gap-3">
          <Mascot expression={expression} size={64} float={phase === "playing"} />
          <motion.div
            key={`${index}-${phase}`}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative mb-2 flex min-h-[3.5rem] flex-1 items-center rounded-2xl rounded-bl-sm border border-hairline bg-surface-card px-4 py-3 text-sm font-semibold text-ink [box-shadow:var(--shadow-card)]"
          >
            {feedbackText}
            {lesson.exam && (
              <span className="ml-1 rounded-pill bg-warning/20 px-1.5 py-0.5 text-[10px] font-extrabold text-warning">
                EXAM
              </span>
            )}
          </motion.div>
        </div>

        {step.fen && (
          <div ref={boardBox} className="flex min-h-0 flex-1 items-center justify-center">
            <div style={{ width: boardSize || undefined, height: boardSize || undefined }}>
              <ChessBoard
                key={index}
                fen={displayFen ?? step.fen}
                orientation={step.orientation ?? "white"}
                onMove={handleMove}
                arrows={phase === "playing" && !isObserving ? step.arrows : []}
                highlight={phase === "playing" && !isObserving ? step.highlight : []}
                interactive={step.kind === "move" && phase === "playing"}
              />
            </div>
          </div>
        )}

        {isObserving && (
          <p className="text-center text-sm font-bold text-brand">▶ Watching the example…</p>
        )}
      </div>

      <FeedbackBar
        phase={phase}
        stepKind={step.kind}
        observeReady={step.kind !== "observe" || observeDone}
        onContinue={
          phase === "correct" ? advance : phase === "wrong" ? () => setPhase("playing") : advance
        }
      />
    </div>
  );
}

function FeedbackBar({
  phase,
  stepKind,
  observeReady,
  onContinue,
}: {
  phase: Phase;
  stepKind: string;
  observeReady: boolean;
  onContinue: () => void;
}) {
  const showContinue =
    phase === "playing" && (stepKind === "info" || (stepKind === "observe" && observeReady));
  const show = phase === "correct" || phase === "wrong" || showContinue;
  const tone = phase === "wrong" ? "bg-danger/10" : phase === "correct" ? "bg-success/10" : "bg-surface-card";

  // Always reserve the footer height so the board never resizes when feedback
  // appears/disappears (no CLS / flicker).
  return (
    <div className="pb-safe sticky bottom-0 z-20 min-h-[5.25rem] px-4 pt-3">
      <AnimatePresence mode="wait">
        {show && (
          <motion.div
            key={phase === "wrong" ? "wrong" : phase === "correct" ? "correct" : "continue"}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={`mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border border-hairline px-4 py-3 ${tone}`}
          >
            <span className="text-sm font-extrabold">
              {phase === "correct" && "🎉 Correct!"}
              {phase === "wrong" && "💡 Let's try again"}
            </span>
            <Button
              variant={phase === "wrong" ? "danger" : "success"}
              onClick={onContinue}
              className="min-w-32"
            >
              {phase === "wrong" ? "Got it" : "Continue"}
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
  graduatedTitle,
  nextLessonId,
  onDone,
}: {
  lesson: Lesson;
  correct: number;
  graduatedTitle: string | null;
  nextLessonId?: string | null;
  onDone: () => void;
}) {
  const [reflectOpen, setReflectOpen] = useState(false);
  const router = useRouter();
  const authed = useSession((s) => s.authed);
  // Prefer the DB-computed next lesson; fall back to the constants graph.
  const nextId = nextLessonId !== undefined ? nextLessonId : nextLessonAfter(lesson.id);
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
          <Button size="sm" block className="mt-3" onClick={() => { audio.play("transition"); router.push("/register"); }}>
            Enroll free
          </Button>
        </motion.div>
      )}

      <div className="mt-2 flex w-full max-w-xs flex-col items-center gap-2">
        {nextId ? (
          <Button
            size="lg"
            block
            onClick={() => {
              audio.play("transition");
              startNav();
              router.push(`/lesson/${nextId}`);
            }}
          >
            Continue learning →
          </Button>
        ) : (
          <Button size="lg" block onClick={onDone}>
            Back to campus
          </Button>
        )}
        <div className="flex w-full gap-2">
          <Button variant="ghost" block onClick={() => setReflectOpen(true)}>
            📝 Reflect
          </Button>
          {nextId && (
            <Button variant="ghost" block onClick={onDone}>
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
