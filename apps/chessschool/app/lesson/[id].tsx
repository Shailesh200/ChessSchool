import { spokenLines, type Step } from "@chessschool/chess";
import { accuracy, copy, dayKey, elapsedSeconds, FLOW_CUES, goalMet, isPerfect, PERFECT_BONUS, visibleStreak } from "@chessschool/design";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable } from "react-native";
import { LessonDone, type LessonSummary } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button, T } from "@/components/ui";
import { LessonSkeleton } from "@/components/Skeleton";
import { useCourse, useLesson } from "@/lib/course";
import { useApp } from "@/lib/state";
import { useCoachVoice } from "@/lib/voice";

type Before = { id: string; done: boolean; streak: number; goal: boolean; xp: number; summary: Omit<LessonSummary, "xp"> };


export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, completeLesson, cue, track } = useApp();
  const course = useCourse();
  const loaded = useLesson(id);
  const [before, setBefore] = useState<Before | null>(null);
  const lesson = loaded ?? course?.lessons.find((l) => l.id === id);
  const hasSteps = Boolean(lesson?.steps);
  const steps = lesson?.steps as Step[] | undefined;
  const lines = useMemo(() => (steps ? spokenLines(steps) : []), [steps]);
  const say = useCoachVoice(id, lines);
  // First run: no account and no welcome yet. The lesson leads on to welcome, never back to an empty stack.
  const firstRun = !state.account && !state.seenWelcome;
  const close = () => (firstRun ? router.replace("/welcome") : router.canGoBack() ? router.back() : router.replace("/today"));
  // A new install with no connection cannot load the lesson: move on rather than wait forever.
  useEffect(() => {
    if (!firstRun || hasSteps) return;
    const t = setTimeout(() => router.replace("/welcome"), 8000);
    return () => clearTimeout(t);
  }, [firstRun, hasSteps]);
  useEffect(() => {
    if (hasSteps && id !== "meet") track("lesson_start", { lesson: id });
  }, [id, hasSteps, track]);

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
      say={say}
      topAction={
        firstRun ? (
          <Pressable accessibilityRole="link" onPress={() => router.push("/login")} hitSlop={8} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 4 }}>
            <T role="label" color="brandText" numberOfLines={1}>
              {copy.lesson.haveAccount}
            </T>
          </Pressable>
        ) : null
      }
      onClose={(step) => {
        track("lesson_quit", { lesson: id, step });
        close();
      }}
      onFinished={(_, tally) => {
        const perfect = (lesson.steps as Step[]).some((st) => st.kind !== "say") && isPerfect(tally);
        const bonus = perfect && !(state.progress.perfect ?? []).includes(id);
        setBefore({
          id,
          done: Boolean(state.progress.completed[id]),
          streak: visibleStreak(state.progress.streak, dayKey(new Date())),
          goal: goalMet(state.progress, state.profile.dailyMinutes, dayKey(new Date())),
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
            streak={streak > b.streak ? streak : undefined}
            goalMet={!b.goal && goalMet(state.progress, state.profile.dailyMinutes, today)}
            summary={{ ...b.summary, xp: Math.max(0, state.progress.xp - b.xp) }}
          >
            {firstRun ? (
              <Button title={copy.welcome.next} icon="arrowRight" onPress={() => router.replace("/welcome")} />
            ) : (
              <>
                {next && !b.done ? <Button title={copy.lesson.nextLesson} icon="arrowRight" onPress={() => router.replace(`/lesson/${next.id}`)} /> : null}
                <Button title={copy.lesson.back} icon="learn" variant={!b.done && next ? "secondary" : "primary"} onPress={() => router.replace("/today")} />
                {!state.account ? <Button title={copy.lesson.save} icon="shield" variant="ghost" onPress={() => router.replace("/signup")} /> : null}
              </>
            )}
          </LessonDone>
        ) : null
      }
    />
  );
}
