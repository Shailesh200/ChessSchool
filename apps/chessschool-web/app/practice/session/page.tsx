"use client";

import { buildDrills, type Step } from "@chessschool/chess";
import { copy, dayKey, goalMet, visibleStreak } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LessonDone } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button } from "@/components/ui";
import { useApp } from "@/lib/state";

export default function PracticeSessionPage() {
  const { ready } = useApp();
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  return <Session />;
}

function Session() {
  const { state, finishPractice, cue } = useApp();
  const router = useRouter();
  const [round, setRound] = useState(0);
  const [steps, setSteps] = useState<Step[]>(() => buildDrills(Object.keys(state.progress.completed)));
  const [before, setBefore] = useState<{ streak: number; goal: boolean } | null>(null);

  useEffect(() => {
    if (!steps.length) router.replace("/practice");
  }, [steps.length, router]);
  if (!steps.length) return null;

  const today = dayKey(new Date());
  const streak = visibleStreak(state.progress.streak, today);
  return (
    <LessonPlayer
      key={round}
      steps={steps}
      closeHref="/practice"
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
              block
              icon="refresh"
              onClick={() => {
                setSteps(buildDrills(Object.keys(state.progress.completed)));
                setBefore(null);
                setRound((r) => r + 1);
              }}
            >
              {copy.practice.again}
            </Button>
            <Button block variant="secondary" href="/gym">
              {copy.practice.back}
            </Button>
          </LessonDone>
        ) : null
      }
    />
  );
}
