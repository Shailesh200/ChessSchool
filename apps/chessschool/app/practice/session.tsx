import { practiceSteps, type Step } from "@chessschool/chess";
import { copy, dayKey, goalMet, visibleStreak } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { LessonDone } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button } from "@/components/ui";
import { LessonSkeleton } from "@/components/Skeleton";
import { useCourse, useLessonScripts } from "@/lib/course";
import { useApp } from "@/lib/state";

export default function PracticeSession() {
  const { state, finishPractice, cue } = useApp();
  const course = useCourse();
  const ids = course ? course.lessons.filter((l) => state.progress.completed[l.id]).map((l) => l.id) : null;
  const scripts = useLessonScripts(ids);
  const [round, setRound] = useState(0);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [before, setBefore] = useState<{ streak: number; goal: boolean } | null>(null);
  useEffect(() => {
    if (!scripts || steps) return;
    const next = practiceSteps(scripts as Step[]);
    if (!next.length) router.replace("/practice");
    else setSteps(next);
  }, [scripts, steps]);
  if (!steps) return <LessonSkeleton />;

  const today = dayKey(new Date());
  const streak = visibleStreak(state.progress.streak, today);
  return (
    <LessonPlayer
      key={round}
      steps={steps}
      onClose={() => (router.canGoBack() ? router.back() : router.replace("/practice"))}
      onFinished={() => {
        setBefore({ streak: visibleStreak(state.progress.streak, dayKey(new Date())), goal: goalMet(state.progress, state.profile.dailyMinutes, dayKey(new Date())) });
        finishPractice();
        cue("level-up");
      }}
      done={
        before ? (
          <LessonDone
            title={copy.practice.doneTitle}
            body={copy.practice.doneBody}
            streak={streak > before.streak ? streak : undefined}
            goalMet={!before.goal && goalMet(state.progress, state.profile.dailyMinutes, today)}
          >
            <Button
              title={copy.practice.again}
              icon="refresh"
              onPress={() => {
                setSteps(practiceSteps((scripts ?? []) as Step[]));
                setBefore(null);
                setRound((r) => r + 1);
              }}
            />
            <Button title={copy.practice.back} variant="secondary" onPress={() => router.replace("/gym")} />
          </LessonDone>
        ) : null
      }
    />
  );
}
