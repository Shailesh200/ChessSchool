import type { Step } from "@chessschool/chess";
import { copy, dayKey, goalMet, visibleStreak } from "@chessschool/design";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { LessonDone } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button } from "@/components/ui";
import { LessonSkeleton } from "@/components/Skeleton";
import { useCourse, useLesson } from "@/lib/course";
import { useApp } from "@/lib/state";

type Before = { id: string; done: boolean; streak: number; goal: boolean };

const close = () => (router.canGoBack() ? router.back() : router.replace("/today"));

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, completeLesson, cue } = useApp();
  const course = useCourse();
  const loaded = useLesson(id);
  const [before, setBefore] = useState<Before | null>(null);
  const lesson = loaded ?? course?.lessons.find((l) => l.id === id);

  if (id === "meet") return <Redirect href="/orientation" />;
  if (course && !course.lessons.some((l) => l.id === id) && !loaded) return <Redirect href="/today" />;
  if (!lesson?.steps) return <LessonSkeleton />;

  const today = dayKey(new Date());
  const streak = visibleStreak(state.progress.streak, today);
  const b = before?.id === id ? before : null;
  const here = course && lesson ? course.lessons.findIndex((l) => l.id === lesson.id) : -1;
  const next = here < 0 || !course ? null : (course.lessons.slice(here + 1).find((l) => !state.progress.completed[l.id]) ?? null);

  return (
    <LessonPlayer
      key={id}
      steps={lesson.steps as Step[]}
      onClose={close}
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
            {next && !b.done ? <Button title={copy.lesson.nextLesson} icon="arrowRight" onPress={() => router.replace(`/lesson/${next.id}`)} /> : null}
            <Button title={copy.lesson.back} icon="learn" variant={!b.done && next ? "secondary" : "primary"} onPress={() => router.replace("/today")} />
            {!state.account ? <Button title={copy.lesson.save} icon="shield" variant="ghost" onPress={() => router.replace("/signup")} /> : null}
          </LessonDone>
        ) : null
      }
    />
  );
}
