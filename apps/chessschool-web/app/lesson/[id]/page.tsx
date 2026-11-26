"use client";

import { spokenLines, type Step } from "@chessschool/chess";
import { accuracy, copy, dayKey, elapsedSeconds, firstLessonId, FLOW_CUES, goalMet, isGuestLockedLesson, isPerfect, lessonAccess, nextOpenLesson, PERFECT_BONUS, visibleStreak } from "@chessschool/design";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LessonDone, type LessonSummary } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button } from "@/components/ui";
import { LessonSkeleton } from "@/components/Skeleton";
import { useCourse, useLesson } from "@/lib/course";
import { useApp } from "@/lib/state";
import { useCoachVoice } from "@/lib/voice";

type Before = { id: string; done: boolean; streak: number; goal: boolean; firstLessonToday: boolean; xp: number; summary: Omit<LessonSummary, "xp"> };

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, ready, completeLesson, cue, showGuestGate, track } = useApp();
  const course = useCourse();
  const { lesson: loaded, guestLimited } = useLesson(id);
  const outline = course?.lessons.find((l) => l.id === id);
  const lesson = loaded ?? outline;
  const guestLocked = isGuestLockedLesson(outline) || isGuestLockedLesson(loaded) || guestLimited;
  const [before, setBefore] = useState<Before | null>(null);
  const [misses, setMisses] = useState(0);

  const unknown = Boolean(course && !lesson);
  useEffect(() => {
    if (id === "meet") router.replace("/orientation");
    else if (unknown) router.replace("/today");
  }, [id, unknown, router]);

  useEffect(() => {
    if (guestLocked) showGuestGate();
  }, [guestLocked, showGuestGate]);

  const hasSteps = Boolean(lesson?.steps);
  const spoken = lesson?.steps as Step[] | undefined;
  const lines = useMemo(() => (spoken ? spokenLines(spoken) : []), [spoken]);
  const say = useCoachVoice(id, lines);
  // First run: no account and no welcome yet. The lesson leads on to welcome.
  const firstRun = ready && !state.account && !state.seenWelcome;
  // A new visitor with no connection cannot load the lesson: move on rather than wait forever.
  useEffect(() => {
    if (!firstRun || hasSteps) return;
    const t = setTimeout(() => router.replace("/welcome"), 8000);
    return () => clearTimeout(t);
  }, [firstRun, hasSteps, router]);
  useEffect(() => {
    if (ready && hasSteps && !guestLocked && id !== "meet") track("lesson_start", { lesson: id });
  }, [ready, id, hasSteps, guestLocked, track]);

  if (guestLocked) {
    return (
      <div className="lesson">
        <div className="lesson-done">
          <h1>{copy.today.guestGate.title}</h1>
          <p className="lead">{copy.today.guestGate.body}</p>
          <div className="flow-actions">
            <Button block href="/signup" icon="shield">
              {copy.today.guestGate.enroll}
            </Button>
            <Button block variant="secondary" href="/login">
              {copy.today.guestGate.login}
            </Button>
            <Button block variant="ghost" href="/today" icon="learn">
              {copy.lesson.back}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready || id === "meet" || unknown || !lesson?.steps) return <LessonSkeleton />;

  const today = dayKey(new Date());
  const streak = visibleStreak(state.progress.streak, today);
  const b = before?.id === id ? before : null;
  const steps = lesson.steps as Step[];
  const interactive = steps.some((step) => step.kind !== "say");
  const next = course ? nextOpenLesson(course, state.progress.completed, id) : null;
  // The first lesson is open on a first run, before the tour.
  const access = course && !(firstRun && id === firstLessonId(course)) ? lessonAccess(course, state.progress.completed, id) : "current";
  const prev = course ? course.lessons[course.lessons.findIndex((l) => l.id === id) - 1] : undefined;

  if (access === "locked") {
    return (
      <div className="lesson">
        <div className="lesson-done">
          <h1>{copy.lesson.locked}</h1>
          <p className="lead">{prev ? copy.lesson.lockedBody(prev.title) : copy.lesson.locked}</p>
          <div className="flow-actions">
            <Button block href="/today" icon="learn">
              {copy.lesson.back}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LessonPlayer
      key={id}
      steps={steps}
      say={say}
      closeHref={firstRun ? "/welcome" : "/today"}
      onClose={(step) => track("lesson_quit", { lesson: id, step })}
      onFinished={(n, tally) => {
        const firstLessonToday = !Object.values(state.progress.completed).some((day) => day === today);
        const perfect = interactive && isPerfect(tally);
        const bonus = perfect && !(state.progress.perfect ?? []).includes(id);
        setMisses(n);
        setBefore({
          id,
          done: Boolean(state.progress.completed[id]),
          streak: visibleStreak(state.progress.streak, dayKey(new Date())),
          goal: goalMet(state.progress, state.profile.dailyMinutes, dayKey(new Date())),
          firstLessonToday,
          xp: state.progress.xp,
          summary: { accuracy: accuracy(tally), seconds: elapsedSeconds(tally, Date.now()), perfectBonus: bonus ? PERFECT_BONUS : undefined, best: tally.best },
        });
        completeLesson(id, { xp: lesson.xp, minutes: lesson.minutes }, { perfect, best: tally.best });
        cue(perfect ? FLOW_CUES.perfect : FLOW_CUES.summary);
      }}
      done={
        b ? (
          <LessonDone
            title={b.done ? copy.today.done : copy.lesson.doneTitle}
            body={b.done ? copy.lesson.replayDone : next ? copy.lesson.doneNext(next.title) : copy.lesson.doneLast}
            recap={b.done ? undefined : copy.lesson.recap(lesson.title)}
            xp={b.done ? undefined : lesson.xp}
            streak={b.firstLessonToday && !b.done && streak > 0 ? streak : undefined}
            goalMet={!b.goal && goalMet(state.progress, state.profile.dailyMinutes, today)}
            hints={interactive ? misses : undefined}
            summary={{ ...b.summary, xp: Math.max(0, state.progress.xp - b.xp) }}
          >
            {firstRun ? (
              <Button block href="/welcome" icon="arrowRight">
                {copy.welcome.next}
              </Button>
            ) : null}
            {next && !b.done && !firstRun ? (
              <Button block href={`/lesson/${next.id}`} icon="arrowRight">
                {copy.lesson.nextLesson}
              </Button>
            ) : null}
            {!next && !b.done && !firstRun ? (
              <Button block href="/play" icon="play">
                {copy.today.heroAllCta}
              </Button>
            ) : null}
            {firstRun ? null : (
              <Button block variant={!b.done ? "secondary" : "primary"} href="/today" icon="learn">
                {copy.lesson.back}
              </Button>
            )}
            {!state.account && !firstRun ? (
              <Button block variant="ghost" href="/signup" icon="shield">
                {copy.lesson.save}
              </Button>
            ) : null}
          </LessonDone>
        ) : null
      }
    />
  );
}
