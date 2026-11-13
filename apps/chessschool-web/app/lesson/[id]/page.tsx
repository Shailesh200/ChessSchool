"use client";

import type { Step } from "@chessschool/chess";
import { copy, dayKey, goalMet, guestClassCap, guestUnitBlocked, lessonAccess, nextOpenLesson, visibleStreak } from "@chessschool/design";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LessonDone } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { GuestGate } from "@/components/PathList";
import { Button } from "@/components/ui";
import { LessonSkeleton } from "@/components/Skeleton";
import { useCourse, useLesson } from "@/lib/course";
import { useApp } from "@/lib/state";

type Before = { id: string; done: boolean; streak: number; goal: boolean; firstLessonToday: boolean };

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, ready, completeLesson, cue } = useApp();
  const course = useCourse();
  const loaded = useLesson(id);
  const lesson = loaded ?? course?.lessons.find((l) => l.id === id);
  const [before, setBefore] = useState<Before | null>(null);
  const [misses, setMisses] = useState(0);

  const unknown = Boolean(course && !lesson);
  useEffect(() => {
    if (id === "meet") router.replace("/orientation");
    else if (unknown) router.replace("/today");
  }, [id, unknown, router]);

  if (!ready || id === "meet" || unknown || !lesson?.steps) return <LessonSkeleton />;

  const today = dayKey(new Date());
  const streak = visibleStreak(state.progress.streak, today);
  const b = before?.id === id ? before : null;
  const steps = lesson.steps as Step[];
  const interactive = steps.some((step) => step.kind !== "say");
  const next = course ? nextOpenLesson(course, state.progress.completed, id) : null;
  const access = course ? lessonAccess(course, state.progress.completed, id) : "current";
  const cap = course && !state.account ? guestClassCap(course) : null;
  const gated = Boolean(course && guestUnitBlocked(course, lesson.unit, cap));
  const prev = course ? course.lessons[course.lessons.findIndex((l) => l.id === id) - 1] : undefined;

  if (gated) {
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
        <GuestGate open onClose={() => router.push("/today")} />
      </div>
    );
  }

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
      closeHref="/today"
      onFinished={(n) => {
        const firstLessonToday = !Object.values(state.progress.completed).some((day) => day === today);
        setMisses(n);
        setBefore({
          id,
          done: Boolean(state.progress.completed[id]),
          streak: visibleStreak(state.progress.streak, dayKey(new Date())),
          goal: goalMet(state.progress, state.profile.dailyMinutes, dayKey(new Date())),
          firstLessonToday,
        });
        completeLesson(id);
        cue("level-up");
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
          >
            {next && !b.done ? (
              <Button block href={`/lesson/${next.id}`} icon="arrowRight">
                {copy.lesson.nextLesson}
              </Button>
            ) : null}
            {!next && !b.done ? (
              <Button block href="/play" icon="play">
                {copy.today.heroAllCta}
              </Button>
            ) : null}
            <Button block variant={!b.done ? "secondary" : "primary"} href="/today" icon="learn">
              {copy.lesson.back}
            </Button>
            {!state.account ? (
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
