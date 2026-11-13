"use client";

import type { Step } from "@chessschool/chess";
import { copy, dayKey, goalMet, lessonAfter, visibleStreak } from "@chessschool/design";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LessonDone } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button } from "@/components/ui";
import { LessonSkeleton } from "@/components/Skeleton";
import { useCourse, useLesson } from "@/lib/course";
import { useApp } from "@/lib/state";

type Before = { id: string; done: boolean; streak: number; goal: boolean };

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, ready, completeLesson, cue } = useApp();
  const course = useCourse();
  const loaded = useLesson(id);
  const lesson = loaded ?? course?.lessons.find((l) => l.id === id);
  const [before, setBefore] = useState<Before | null>(null);

  const unknown = Boolean(course && !lesson);
  useEffect(() => {
    if (id === "meet") router.replace("/orientation");
    else if (unknown) router.replace("/today");
  }, [id, unknown, router]);

  if (!ready || id === "meet" || unknown || !lesson?.steps) return <LessonSkeleton />;

  const today = dayKey(new Date());
  const streak = visibleStreak(state.progress.streak, today);
  const b = before?.id === id ? before : null;
  const next = course ? lessonAfter(course, id) : null;

  return (
    <LessonPlayer
      key={id}
      steps={lesson.steps as Step[]}
      closeHref="/today"
      onFinished={() => {
        setBefore({
          id,
          done: Boolean(state.progress.completed[id]),
          streak: visibleStreak(state.progress.streak, dayKey(new Date())),
          goal: goalMet(state.progress, state.profile.dailyMinutes, dayKey(new Date())),
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
            streak={streak > b.streak ? streak : undefined}
            goalMet={!b.goal && goalMet(state.progress, state.profile.dailyMinutes, today)}
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
