"use client";

import type { Step } from "@chessschool/chess";
import { copy, dayKey, goalMet, mistakeItems, PRACTICE_SET, practiceRequest, recordCombo, visibleStreak, type PracticeItem } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LessonDone } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button } from "@/components/ui";
import { LessonSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

export default function PracticeSessionPage() {
  const { ready } = useApp();
  if (!ready) return <LessonSkeleton />;
  return <Session />;
}

function Session() {
  const { state, finishPractice, cue, answerReview, setPracticeNext, update } = useApp();
  const router = useRouter();
  const [round, setRound] = useState(0);
  const [items, setItems] = useState<PracticeItem[] | null>(null);
  const [before, setBefore] = useState<{ streak: number; goal: boolean } | null>(null);

  // One request per round: due reviews first, then finished lessons. The spare half is kept for offline use.
  useEffect(() => {
    let live = true;
    // Positions from the learner's own games come first; the server leans the rest toward weak ideas.
    const own = mistakeItems(state.mistakes, state.review, dayKey(new Date()));
    api
      .practice(practiceRequest(state.progress.completed, state.review, dayKey(new Date()), state.progress.skills))
      .then(({ items: got }) => {
        if (!live) return;
        if (!got.length && !own.length) return router.replace("/practice");
        setItems([...own, ...got].slice(0, PRACTICE_SET));
        setPracticeNext(got.slice(PRACTICE_SET));
      })
      .catch(() => {
        if (!live) return;
        if (!state.practiceNext.length && !own.length) return router.replace("/practice");
        setItems([...own, ...state.practiceNext].slice(0, PRACTICE_SET));
        // Offline: use one set and keep the rest for the next days.
        setPracticeNext(state.practiceNext.slice(Math.max(0, PRACTICE_SET - own.length)));
      });
    return () => {
      live = false;
    };
    // Fetches once per round; the state read here is the state when the round starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  if (!items) return <LessonSkeleton />;

  const today = dayKey(new Date());
  const streak = visibleStreak(state.progress.streak, today);
  return (
    <LessonPlayer
      key={round}
      steps={items.map((i) => i.step) as unknown as Step[]}
      closeHref="/practice"
      onStep={(index, missed) => {
        const ref = items[index]?.ref;
        if (ref) answerReview(ref, missed);
      }}
      onFinished={(_, tally) => {
        update((s) => recordCombo(s, tally.best, new Date()));
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
                setItems(null);
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
