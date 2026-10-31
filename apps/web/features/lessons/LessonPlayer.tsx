"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChessBoard } from "@/features/board/ChessBoard";
import { LessonStage } from "./LessonStage";
import { LessonKitFooter } from "./LessonKitFooter";
import { KitLottie } from "@/components/motion/KitLottie";
import { ChessEngine } from "@/features/chess-engine/engine";
import { CoachAvatar } from "@/components/ui/coachCharacters/CoachAvatar";
import type { CoachAvatarState } from "@/features/coaching/characters";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";
import { useProgression, isoDay } from "@/core/store/progression.store";
import { trackEvent } from "@/core/analytics/track";
import { pulseTrack } from "@/lib/pulse";
import { usePlan, ROUTINE_STEPS } from "@/core/store/plan.store";
import { useSettings } from "@/core/store/settings.store";
import { useSession } from "@/core/store/session.store";
import { startNav } from "@/core/store/nav.store";
import { checkLessonAchievements } from "@/features/progression/achievements";
import { unlockAndCelebrate } from "@/features/progression/celebrate";
import { getClass, classByExamId, nextLessonAfter } from "@/features/school/structure";
import { isTutorialLesson, scoredStepCount } from "@/features/school/classExam";
import {
  applyCoachLine,
  quizUiLabels,
  type CoachContext,
} from "@/features/coaching/personality";
import { useCoachSpeech } from "@/core/hooks/useCoachSpeech";
import { prefetchCoachText } from "@/core/audio/coachSpeech";
import { EnrollPrompt, EnrollPromptBanner } from "@/components/auth/EnrollPrompt";
import { ReflectSheet } from "@/features/journal/ReflectSheet";
import { CeremonyOverlay } from "@/components/ceremony/CeremonyOverlay";
import { pickLessonHint } from "@chess-school/core";
import {
  deriveTutorialVisuals,
  expectedPromotion,
  formatCoachText,
  isPreschoolLesson,
  lessonsAttemptedCount,
  matchesSolution,
  shouldAutoOpenEnrollPrompt,
  shouldShowEnrollPrompt,
} from "@chess-school/progression";
import { PreschoolQuiz } from "./PreschoolQuiz";
import { LessonCompleteWeekStrip } from "./LessonCompleteExtras";
import { formatLessonDurationMs, kitXpPopLottieId } from "./lessonKitXp";
import { resolveKitLessonScreen } from "./lessonKitDevFixtures";
import type { Lesson, LessonStep } from "./types";
import type { BoardArrow, MoveInput, Square } from "@/core/types/chess";

const PROMO_NAMES: Record<string, string> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

type LessonCeremony =
  | { variant: "graduation"; title: string; badge: string }
  | { variant: "exam"; title: string; badge: string; subtitle: string }
  | null;

type Phase = "playing" | "correct" | "wrong" | "complete";

/** The single legal move that turns fenA into fenB (the opponent's reply), or null. */
function findReply(fenA: string, fenB: string): { from: Square; to: Square } | null {
  try {
    const g = new ChessEngine(fenA);
    const target = fenB.split(" ")[0];
    for (const m of g.legalMoves()) {
      const t = g.clone();
      if (
        t.move({ from: m.from, to: m.to, promotion: m.promotion }) &&
        t.fen().split(" ")[0] === target
      ) {
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
  devPreview,
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
  /** Dev-only (`/dev/lesson-kit`) — initial step/phase for kit screen QA. */
  devPreview?: {
    stepIndex?: number;
    phase?: Phase;
    hintLevel?: number;
    /** Muse kit copy for pixel QA (`ttl` tag + h2). */
    kitLabels?: { tag?: string; title?: string };
    /** Overrides board tip / hintline for dev pixel QA. */
    hintLine?: string;
  };
}) {
  const router = useRouter();
  const [index, setIndex] = useState(devPreview?.stepIndex ?? 0);
  const [phase, setPhase] = useState<Phase>(devPreview?.phase ?? "playing");
  const step = lesson.steps[index] as LessonStep | undefined;
  /** Overrides `step.fen` mid-step (moves, observe playback); undefined → use step FEN. */
  const [displayFen, setDisplayFen] = useState<string | undefined>(undefined);
  const [correctCount, setCorrectCount] = useState(0);
  const [observeDone, setObserveDone] = useState(false);
  const [ceremony, setCeremony] = useState<LessonCeremony>(null);
  const [promoted, setPromoted] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(devPreview?.hintLevel ?? 0);
  const hintsUsedRef = useRef(0);
  const lessonStartedAt = useRef(Date.now());
  const replyAfterCorrectRef = useRef<{ reply: { from: Square; to: Square }; fen: string } | null>(
    null,
  );
  /** After opponent reply animation, wait for a second Continue (kit manual flow). */
  const awaitReplyContinueRef = useRef(false);
  const [movedTo, setMovedTo] = useState<Square | null>(null);
  const [oppMove, setOppMove] = useState<{ from: Square; to: Square } | null>(null);
  const correctRef = useRef(0); // synchronous correct count (auto-advance reads it fresh)
  const wrongRef = useRef(0); // wrong moves this attempt → report-card scoring
  const [finalMistakes, setFinalMistakes] = useState(0);
  const timers = useRef<number[]>([]);
  /**
   * Lesson id already completed by this player instance. Tutorials never leave the
   * "playing" phase before navigating, so a double-tap on Continue (or a slow
   * route change) would otherwise call finish() twice and award XP twice.
   */
  const finishedLessonId = useRef<string | null>(null);

  const progression = useProgression();
  const sound = useSettings((s) => s.sound);
  const coachCharacter = useSettings((s) => s.coachCharacter);
  const toggleSetting = useSettings((s) => s.toggle);
  const total = lesson.steps.length;

  useEffect(() => {
    trackEvent("lesson_start", {
      lessonId: lesson.id,
      tag: lesson.tag,
      exam: lesson.exam,
    });
    if (lesson.exam) {
      pulseTrack("exam_start", { lesson_id: lesson.id });
    }
    if (homeworkStep || dailyPuzzle) {
      pulseTrack("homework_start", {
        step_id: homeworkStep ?? "daily",
        homework_id: lesson.id,
        daily: Boolean(dailyPuzzle),
      });
    }
  }, [lesson.id, lesson.tag, lesson.exam, homeworkStep, dailyPuzzle]);

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
          const piece = expectedPromotion(step, `${from}:${to}`) ?? "q";
          const applied = engine.move({ from: from!, to: to!, promotion: piece });
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

  const coachSeed = step ? `${lesson.id}:${step.id}:${index}` : lesson.id;
  const rawFeedback = step
    ? formatCoachText(
        phase === "correct"
          ? promoted
            ? `Promoted to a ${PROMO_NAMES[promoted] ?? "piece"}! A powerful new piece.`
            : step.kind === "quiz"
              ? ""
              : (step.successText ?? "Nice work!")
          : phase === "wrong"
            ? step.kind === "quiz"
              ? (step.failText ?? "")
              : (step.failText ?? "Not quite — try again!")
            : step.kind === "quiz"
              ? ""
              : step.coach,
      )
    : "";
  const coachContext: CoachContext = !step
    ? "lesson"
    : phase === "correct"
      ? step.kind === "quiz"
        ? "quiz-success"
        : "success"
      : phase === "wrong"
        ? step.kind === "quiz"
          ? "quiz-wrong"
          : "wrong"
        : step.kind === "quiz"
          ? "quiz"
          : "lesson";
  const feedbackText = applyCoachLine(
    rawFeedback,
    coachCharacter,
    coachContext,
    coachSeed,
  );
  useCoachSpeech(feedbackText, coachContext, phase !== "complete" && !!step, true);

  // Warm TTS for the next step while the student works on the current one.
  useEffect(() => {
    if (phase === "complete") return;
    const next = lesson.steps[index + 1];
    if (!next) return;
    const nextRaw = next.kind === "quiz" ? "" : formatCoachText(next.coach ?? "");
    if (!nextRaw.trim()) return;
    const nextLine = applyCoachLine(
      nextRaw,
      coachCharacter,
      next.kind === "quiz" ? "quiz" : "lesson",
      `${lesson.id}:${next.id}:${index + 1}`,
    );
    void prefetchCoachText(nextLine);
  }, [index, lesson.id, lesson.steps, phase, coachCharacter]);

  useEffect(() => {
    if (phase === "complete" || !feedbackText.trim()) return;
    void prefetchCoachText(feedbackText);
  }, [feedbackText, phase]);

  if (!step) return null;

  const avatarState: CoachAvatarState =
    phase === "correct"
      ? "success"
      : phase === "wrong"
        ? "miss"
        : step.kind === "move" || step.kind === "quiz"
          ? "think"
          : "idle";

  function advance() {
    if (index + 1 >= total) finish();
    else {
      setDisplayFen(undefined);
      setObserveDone(false);
      setPromoted(null);
      setHintLevel(0);
      setMovedTo(null);
      setOppMove(null);
      awaitReplyContinueRef.current = false;
      replyAfterCorrectRef.current = null;
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
    if (finishedLessonId.current === lesson.id) return;
    finishedLessonId.current = lesson.id;
    // Tutorials (no puzzles to solve) just mark done and flow to the next lesson —
    // no "lesson complete" celebration screen.
    const isTutorial = isTutorialLesson(lesson.steps, lesson.exam);
    if (isTutorial) {
      progression.recordLesson(lesson.id, 1, 1); // counts as completed
      progression.awardXp(lesson.xp);
      progression.registerActivity(isoDay());
      markHomeworkDone();
      if (dailyPuzzle) progression.markDailyPuzzleDone();
      trackEvent("lesson_complete", {
        lessonId: lesson.id,
        tutorial: true,
        xp: lesson.xp,
      });
      const nextId =
        nextLessonId !== undefined ? nextLessonId : nextLessonAfter(lesson.id);
      startNav();
      router.push(nextId ? `/lesson/${nextId}` : "/academy");
      return;
    }
    setPhase("complete");
    const interactive = scoredStepCount(lesson.steps) || 1;
    const correct = correctRef.current; // fresh count (state may lag the auto-advance)
    setFinalMistakes(wrongRef.current);
    const ratio = correct / interactive;
    trackEvent("lesson_complete", {
      lessonId: lesson.id,
      correct,
      interactive,
      ratio,
      mistakes: wrongRef.current,
      xp: lesson.xp,
      exam: lesson.exam,
    });
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
    }).forEach((id) => unlockAndCelebrate(id));

    // School exam: passing unlocks the next school (no class to graduate).
    if (schoolExam) {
      const passed = ratio >= 0.67;
      trackEvent("exam_complete", {
        lessonId: lesson.id,
        examType: "school",
        passed,
        ratio,
        stage: schoolExam.stage,
      });
      if (passed) {
        progression.passSchoolExam(schoolExam.stage);
        setCeremony({
          variant: "exam",
          title: `${schoolExam.nextName} unlocked!`,
          subtitle: "You passed the school exam!",
          badge: "School exam passed",
        });
        audio.play("graduation");
      } else {
        audio.play("fail");
      }
      return;
    }

    // Resolve the lesson's class — prefer the DB-passed class (works for
    // generated classes); fall back to the constants for older callers.
    const dbClass = lessonClass ?? null;
    const constCls = !dbClass
      ? (getClass(lesson.unit) ?? classByExamId(lesson.id))
      : null;
    const cls =
      dbClass ??
      (constCls
        ? { id: constCls.id, title: constCls.title, lessonIds: constCls.lessonIds }
        : null);

    // Exam: passing graduates the whole class.
    if (lesson.exam && ratio >= 0.67 && cls) {
      trackEvent("exam_complete", {
        lessonId: lesson.id,
        examType: "class",
        passed: true,
        ratio,
        classId: cls.id,
      });
      cls.lessonIds.forEach((id) => progression.recordLesson(id, 1, 1));
      progression.graduateClass(cls.id);
      trackEvent("class_graduate", {
        classId: cls.id,
        classTitle: cls.title,
        via: "exam",
      });
      setCeremony({
        variant: "graduation",
        title: cls.title,
        badge: "Class graduated",
      });
      audio.play("graduation");
      return;
    }

    if (lesson.exam) {
      trackEvent("exam_complete", {
        lessonId: lesson.id,
        examType: "class",
        passed: false,
        ratio,
        classId: cls?.id,
      });
    }

    // Normal lesson: did finishing it complete (graduate) the whole class?
    if (cls && !progression.graduatedClasses.includes(cls.id)) {
      const records = useProgression.getState().lessons;
      const allMastered =
        cls.lessonIds.length > 0 &&
        cls.lessonIds.every((id) => (records[id]?.mastery ?? 0) >= 0.9);
      if (allMastered) {
        progression.graduateClass(cls.id);
        trackEvent("class_graduate", {
          classId: cls.id,
          classTitle: cls.title,
          via: "mastery",
        });
        setCeremony({
          variant: "graduation",
          title: cls.title,
          badge: "Class graduated",
        });
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
    if (matchesSolution(step, move)) {
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
      const reply =
        next?.kind === "move" && next.fen ? findReply(engine.fen(), next.fen) : null;
      if (reply && next?.fen) {
        replyAfterCorrectRef.current = { reply, fen: next.fen };
      } else {
        replyAfterCorrectRef.current = null;
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
    return true; // keep the piece on the board; we control it via displayFen
  }

  function handleQuizAnswer(ok: boolean) {
    if (ok) {
      correctRef.current += 1;
      setCorrectCount(correctRef.current);
      setPhase("correct");
    } else {
      wrongRef.current += 1;
      setPhase("wrong");
    }
  }

  const quizLabels =
    step.kind === "quiz" ? quizUiLabels(coachCharacter, coachSeed) : null;

  if (phase === "complete") {
    return (
      <LessonComplete
        lesson={lesson}
        correct={correctCount}
        mistakes={finalMistakes}
        ceremony={ceremony}
        nextLessonId={nextLessonId}
        homeworkStep={homeworkStep}
        durationMs={Date.now() - lessonStartedAt.current}
        hintsUsed={hintsUsedRef.current}
        interactiveSteps={scoredStepCount(lesson.steps) || 1}
        onDone={() => router.push("/academy")}
      />
    );
  }

  const isObserving = step.kind === "observe" && !observeDone;
  const solvable = step.kind === "move" && phase === "playing";
  const toMove: "w" | "b" | null =
    step.kind === "move" && step.fen
      ? (new ChessEngine(step.fen).turn() as "w" | "b")
      : null;
  // Two-stage hint: 1 = highlight the piece to move, 2 = also show the arrow.
  const hintFrom: Square | null =
    hintLevel >= 1 && solvable && step.solution?.[0]
      ? (step.solution[0].split(":")[0] as Square)
      : null;
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

  const preschool = isPreschoolLesson(lesson.id);
  const tutorial = deriveTutorialVisuals(step);
  const boardArrows: BoardArrow[] = preschool
    ? [
        ...tutorial.arrows,
        ...(phase === "playing" && solvable && !isObserving ? hintArrows : []),
      ]
    : phase === "playing" && !isObserving
      ? [...(step.arrows ?? []), ...hintArrows]
      : [];
  const boardHighlight: Square[] = preschool
    ? [
        ...tutorial.highlight,
        ...(phase === "playing" && solvable && !isObserving && hintFrom
          ? [hintFrom]
          : []),
      ]
    : phase === "playing" && !isObserving
      ? [...(step.highlight ?? []), ...(hintFrom ? [hintFrom] : [])]
      : [];
  const boardHighlightFiles = preschool
    ? tutorial.highlightFiles
    : (step.highlightFiles ?? []);
  const boardHighlightRanks = preschool
    ? tutorial.highlightRanks
    : (step.highlightRanks ?? []);
  const ringSquares: Square[] = [
    ...(step.visualSquare ? [step.visualSquare as Square] : []),
    ...((step.visualSquares ?? []) as Square[]),
    ...(hintFrom ? [hintFrom] : []),
    ...tutorial.highlight.filter((sq) => hintLevel >= 1 || step.kind === "quiz"),
  ];

  const progressPct = Math.round(((index + (phase === "correct" ? 1 : 0)) / total) * 100);
  const stepTag =
    devPreview?.kitLabels?.tag ??
    (step.kind === "quiz"
      ? `${lesson.title} · Quiz`
      : step.kind === "move"
        ? `${lesson.title} · Your turn`
        : step.kind === "observe"
          ? `${lesson.title} · Example`
          : `${lesson.title} · Intro`);
  const stepTitle =
    devPreview?.kitLabels?.title ??
    (step.kind === "quiz"
      ? (step.question ?? lesson.title)
      : step.kind === "move"
        ? lesson.subtitle || lesson.title
        : lesson.title);
  const tipText =
    devPreview?.hintLine ??
    pickLessonHint({ stepTag: step.tag, lessonTag: lesson.tag });
  const kitScreen = resolveKitLessonScreen({ phase, step, hintLevel });
  const successTitle =
    phase === "correct" && promoted
      ? `Promoted to a ${PROMO_NAMES[promoted] ?? "piece"}!`
      : (step.successText ?? "Nice work!");
  const failTitle = step.failText?.split(/[.!?]/)[0] || "Not quite";
  const failWhy =
    step.failText && step.failText.length > failTitle.length
      ? step.failText
      : tipText;

  function continueFromCorrect() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (awaitReplyContinueRef.current) {
      awaitReplyContinueRef.current = false;
      setOppMove(null);
      advance();
      return;
    }
    const pending = replyAfterCorrectRef.current;
    if (pending) {
      replyAfterCorrectRef.current = null;
      setMovedTo(null);
      setOppMove(pending.reply);
      setDisplayFen(pending.fen);
      audio.play("move");
      awaitReplyContinueRef.current = true;
      timers.current.push(
        window.setTimeout(() => {
          setOppMove(null);
        }, 850),
      );
      return;
    }
    advance();
  }

  function tryAgainFromWrong() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (step?.fen) setDisplayFen(step.fen);
    setMovedTo(null);
    setPhase("playing");
  }

  function continueStep() {
    if (phase === "correct") continueFromCorrect();
    else advance();
  }

  function revealHintFromBar() {
    if (!step?.fen) return;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setDisplayFen(step.fen);
    setMovedTo(null);
    setHintLevel((h) => {
      const next = Math.min(h + 1, 2);
      if (next > h) hintsUsedRef.current += 1;
      return next;
    });
    setPhase("playing");
    audio.play("notify");
    haptics.fire("tap");
  }

  return (
    <LessonStage
      kitScreen={kitScreen}
      header={
        <div className="cs-lessonhead">
          <button
            type="button"
            onClick={() => {
              startNav();
              router.push("/academy");
            }}
            aria-label="Close lesson"
            className="cs-iconbtn"
          >
            <svg className="cs-ic" viewBox="0 0 24 24" aria-hidden>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
          <div
            className="cs-progress"
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ ["--v" as string]: `${progressPct}%` }}
          >
            <i />
          </div>
          <button
            type="button"
            onClick={() => {
              audio.unlock();
              toggleSetting("sound");
              if (!sound) audio.play("notify");
            }}
            aria-label={sound ? "Mute sounds" : "Unmute sounds"}
            aria-pressed={sound}
            className="cs-iconbtn cs-iconbtn--plain"
          >
            {sound ? <Icon name="volume" size={18} /> : <Icon name="volumeOff" size={18} />}
          </button>
        </div>
      }
      coachTitle={
        <div className="ttl">
          <span className="cs-tag">{stepTag}</span>
          <h2 className="cs-h3">{stepTitle}</h2>
        </div>
      }
      coach={
        <div className="cs-coach">
          <CoachAvatar
            character={coachCharacter}
            state={avatarState}
            size="lg"
            className="cs-avatar cs-avatar--lg shrink-0"
          />
          <motion.div
            key={`${index}-${phase}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="lesson-coach-bubble"
            className="cs-bubble cs-bubble--strong lesson-stage-bubble"
          >
            <p className="whitespace-pre-wrap">{feedbackText}</p>
            {lesson.exam && (
              <span className="cs-tag cs-tag--medium mt-1 inline-block">Exam</span>
            )}
          </motion.div>
        </div>
      }
      board={
        step.kind === "quiz" ? (
          <div className="flex w-full flex-col items-center px-2 py-1">
            <PreschoolQuiz
              key={index}
              step={step}
              phase={phase}
              answerLabel={quizLabels?.answers}
              onAnswer={handleQuizAnswer}
            />
          </div>
        ) : (
          step.fen && (
            <div
              className="lesson-stage-board-frame relative"
              data-testid="lesson-board-frame"
            >
              {/* Size comes from the stage's scroll container (see LessonStage),
                  never re-measured, so the board cannot resize/flicker when the
                  feedback footer or coach text changes. */}
              <ChessBoard
                key={index}
                boardId={`lesson-${lesson.id}`}
                fen={displayFen ?? step.fen}
                orientation={step.orientation ?? "white"}
                onMove={handleMove}
                showNotation={preschool}
                arrows={boardArrows}
                highlight={boardHighlight}
                highlightFiles={boardHighlightFiles}
                highlightRanks={boardHighlightRanks}
                lastMove={oppMove}
                successSquare={phase === "correct" ? movedTo : null}
                checkSquare={phase === "wrong" ? movedTo : null}
                ringSquares={ringSquares}
                interactive={step.kind === "move" && phase === "playing"}
              />
            </div>
          )
        )
      }
      extras={
        <>
          <div className="lesson-stage-controls-row" data-testid="lesson-hint-bar">
            {toMove ? (
              <span className="hintline">
                <span
                  className={`inline-block h-4 w-4 shrink-0 rounded-full border border-current ${
                    toMove === "w" ? "bg-white" : "bg-[#1c1b2e]"
                  }`}
                />
                {toMove === "w" ? "White" : "Black"} to move
              </span>
            ) : isObserving ? (
              <p className="hintline">
                <Icon name="playFill" size={14} />
                Watching the example…
              </p>
            ) : null}
            {solvable && !lesson.exam && !isObserving ? (
              <div className="ladder" role="list">
                <button
                  type="button"
                  onClick={() => {
                    setHintLevel((h) => {
                      const next = Math.min(h + 1, 2);
                      if (next > h) hintsUsedRef.current += 1;
                      return next;
                    });
                    audio.play("notify");
                    haptics.fire("tap");
                  }}
                  disabled={hintLevel >= 2}
                  className="cs-btn cs-btn--soft cs-btn--sm"
                  data-testid="lesson-hint-button"
                >
                  <Icon name="bulb" size={16} />
                  {hintLevel === 0
                    ? "Hint 1 of 3"
                    : hintLevel === 1
                      ? "Hint 2 of 3"
                      : "Hint 3 of 3"}
                </button>
              </div>
            ) : null}
          </div>
          {hintLevel >= 1 && solvable ? (
            <div className="ladder" role="list" data-testid="lesson-hint-ladder">
              <span
                className={`cs-tag ${hintLevel >= 1 ? "cs-tag--easy" : ""}`}
                role="listitem"
              >
                1 Nudge
              </span>
              <span
                className={`cs-tag ${hintLevel >= 2 ? "cs-tag--easy" : ""}`}
                role="listitem"
              >
                2 Highlight
              </span>
              <span
                className={`cs-tag ${hintLevel >= 2 ? "cs-tag--accent" : ""}`}
                role="listitem"
              >
                3 Arrow
              </span>
            </div>
          ) : null}
          {step.kind !== "quiz" ? (
            <div className="hintline" data-testid="lesson-tip">
              <Icon name="bulb" size={18} className="shrink-0" />
              <span>{tipText}</span>
            </div>
          ) : null}
        </>
      }
      footer={
        <LessonKitFooter
          phase={phase}
          stepKind={step.kind}
          observeReady={step.kind !== "observe" || observeDone}
          playing={phase === "playing"}
          quizReady={step.kind === "quiz" && phase === "correct"}
          solvable={solvable}
          exam={lesson.exam}
          successTitle={successTitle}
          successWhy={tipText}
          failTitle={failTitle}
          failWhy={failWhy}
          onContinue={continueStep}
          onShowHint={revealHintFromBar}
          onTryAgain={tryAgainFromWrong}
        />
      }
    />
  );
}

export function LessonComplete({
  lesson,
  correct,
  mistakes,
  ceremony,
  nextLessonId,
  homeworkStep,
  durationMs,
  hintsUsed,
  interactiveSteps,
  onDone,
}: {
  lesson: Lesson;
  correct: number;
  mistakes: number;
  ceremony: LessonCeremony;
  nextLessonId?: string | null;
  homeworkStep?: string;
  durationMs: number;
  hintsUsed: number;
  interactiveSteps: number;
  onDone: () => void;
}) {
  const [reflectOpen, setReflectOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const authed = useSession((s) => s.authed);
  const lessons = useProgression((s) => s.lessons);
  const dismissedAt = useSettings((s) => s.enrollPromptDismissedAt);
  const coachCharacter = useSettings((s) => s.coachCharacter);
  const streak = useProgression((s) => s.streak);
  const xpLottie = kitXpPopLottieId(lesson.xp);
  const perPuzzle =
    interactiveSteps > 0 ? Math.round(lesson.xp / interactiveSteps) : lesson.xp;
  const completeQuote = applyCoachLine(
    "Lesson done! That's real progress.",
    coachCharacter,
    "success",
    `${lesson.id}:complete`,
  );
  const lessonsAttempted = lessonsAttemptedCount(lessons);
  const showEnroll = shouldShowEnrollPrompt({
    authed,
    dismissedAt,
    lessonsAttempted,
  });
  // Ceremony mounts once after a lesson — open the sheet from initial state
  // (avoids setState-in-effect). Backdrop close only hides for this screen.
  const [enrollOpen, setEnrollOpen] = useState(() =>
    shouldAutoOpenEnrollPrompt({
      authed,
      dismissedAt,
      lessonsAttempted,
    }),
  );
  const homeworkDoneCount = usePlan((s) => s.routineDone.length);
  const isHomework = !!homeworkStep;
  const allHomeworkDone = homeworkDoneCount >= ROUTINE_STEPS.length;
  // Prefer the DB-computed next lesson; fall back to the constants graph.
  // Homework never chains into "continue learning" — it returns to the homework screen.
  const nextId = isHomework
    ? null
    : nextLessonId !== undefined
      ? nextLessonId
      : nextLessonAfter(lesson.id);
  const go = (id: string, href: string, action?: () => void) => {
    if (busy) return;
    setBusy(id);
    audio.play("transition");
    startNav();
    if (action) action();
    else router.push(href);
  };

  const variant = ceremony?.variant ?? (lesson.exam ? "exam" : "lesson");
  const headline =
    ceremony?.title ??
    (isHomework
      ? allHomeworkDone
        ? "All homework done for today!"
        : "Homework done!"
      : lesson.exam
        ? "Exam complete!"
        : "Lesson complete!");
  const subtitle =
    ceremony?.variant === "exam"
      ? ceremony.subtitle
      : ceremony?.variant === "graduation"
        ? "You've mastered this class. The next one is unlocked!"
        : isHomework
          ? allHomeworkDone
            ? "You've completed every routine today — see you tomorrow!"
            : "Nice work. Head back to finish the rest of today's homework."
          : undefined;

  return (
    <div
      className="min-h-dvh bg-[var(--cs-bg)] text-[var(--cs-text)]"
      data-testid="lesson-complete-screen"
      data-screen="les-complete"
    >
      <CeremonyOverlay
        open
        variant={variant}
        title={headline}
        subtitle={subtitle}
        badge={ceremony?.badge}
      >
        <div className="dn w-full max-w-none p-0">
          <KitLottie id="confetti" className="cf-lot" />
          <div className="hero2">
            <CoachAvatar
              character={coachCharacter}
              state="success"
              size="xl"
              className="cs-avatar bigav"
            />
            <h1 className="cs-h1">{headline}</h1>
            {subtitle ? <p className="cs-muted">{subtitle}</p> : null}
            <p className="cs-muted">{lesson.subtitle || lesson.title}</p>
            <p className="quote" data-testid="lesson-complete-quote">
              &ldquo;{completeQuote}&rdquo;
            </p>
            <KitLottie id={xpLottie} className="xp-lot2" />
            <p className="cs-muted xpsum" data-testid="lesson-complete-xp-summary">
              {interactiveSteps} puzzles × +{perPuzzle} XP = {lesson.xp} XP
            </p>
          </div>
          <div className="r">
            <div className="cs-stats">
              <div className="cs-stat">
                <span className="cs-num">
                  {correct}/{interactiveSteps}
                </span>
                <span>Puzzles</span>
              </div>
              <div className="cs-stat">
                <span className="cs-num">{hintsUsed}</span>
                <span>Hint used</span>
              </div>
              <div className="cs-stat">
                <span className="cs-num">{formatLessonDurationMs(durationMs)}</span>
                <span>Time</span>
              </div>
            </div>
            <div className="cs-streakcard">
              <div className="flame">
                <KitLottie id="streak-flame" loop className="flame-lot" />
              </div>
              <div>
                <span className="cs-num">{streak}</span>
                <b>day streak</b>
              </div>
              <em>+1 today</em>
            </div>
            <LessonCompleteWeekStrip lessonDoneToday />

          {showEnroll && (
            <EnrollPromptBanner
              next={nextId ? `/lesson/${nextId}` : "/academy"}
              className="w-full"
            />
          )}

          <EnrollPrompt
            open={enrollOpen}
            onClose={() => setEnrollOpen(false)}
            next={nextId ? `/lesson/${nextId}` : "/academy"}
          />

          <div className="flex w-full flex-col items-center gap-2">
            {isHomework ? (
              allHomeworkDone ? (
                <button
                  type="button"
                  className="cs-btn cs-btn--block"
                  disabled={busy === "home"}
                  onClick={() => go("home", "/academy", onDone)}
                >
                  Back to academy →
                </button>
              ) : (
                <button
                  type="button"
                  className="cs-btn cs-btn--block"
                  disabled={busy === "hw"}
                  onClick={() => go("hw", "/plan")}
                >
                  Continue your homework →
                </button>
              )
            ) : nextId ? (
              <button
                type="button"
                className="cs-btn cs-btn--block"
                disabled={busy === "next"}
                onClick={() => go("next", `/lesson/${nextId}`)}
              >
                Continue learning →
              </button>
            ) : (
              <button
                type="button"
                className="cs-btn cs-btn--block"
                disabled={busy === "home"}
                onClick={() => go("home", "/academy", onDone)}
              >
                Back to academy
              </button>
            )}
            <div className="flex w-full gap-2">
              <Button variant="ghost" block onClick={() => setReflectOpen(true)}>
                Reflect
              </Button>
              {!isHomework && nextId && (
                <Button
                  variant="ghost"
                  block
                  loading={busy === "home"}
                  onClick={() => go("home", "/academy", onDone)}
                >
                  Back to academy
                </Button>
              )}
            </div>
          </div>
          </div>
        </div>
      </CeremonyOverlay>
      <ReflectSheet
        open={reflectOpen}
        onClose={() => setReflectOpen(false)}
        kind={lesson.exam ? "exam" : "lesson"}
        title={lesson.title}
        summary={
          ceremony
            ? `${ceremony.variant === "exam" ? "Passed exam" : "Graduated"} ${ceremony.title}. Scored ${correct} correct.`
            : `Completed “${lesson.title}” with ${correct} correct.`
        }
        refId={lesson.id}
      />
    </div>
  );
}
