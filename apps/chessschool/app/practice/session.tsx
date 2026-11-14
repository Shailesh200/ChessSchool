import type { Step } from "@chessschool/chess";
import { copy, dayKey, goalMet, PRACTICE_SET, practiceRequest, visibleStreak, type PracticeItem } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { LessonDone } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button } from "@/components/ui";
import { LessonSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

const leave = () => (router.canGoBack() ? router.back() : router.replace("/practice"));

export default function PracticeSession() {
  const { state, ready, finishPractice, cue, answerReview, setPracticeNext } = useApp();
  const [round, setRound] = useState(0);
  const [items, setItems] = useState<PracticeItem[] | null>(null);
  const [before, setBefore] = useState<{ streak: number; goal: boolean } | null>(null);

  // One request per round: due reviews first, then finished lessons. The spare half is kept for offline use.
  useEffect(() => {
    if (!ready || items) return;
    let live = true;
    api
      .practice(practiceRequest(state.progress.completed, state.review, dayKey(new Date())))
      .then(({ items: got }) => {
        if (!live) return;
        if (!got.length) return leave();
        setItems(got.slice(0, PRACTICE_SET));
        setPracticeNext(got.slice(PRACTICE_SET));
      })
      .catch(() => {
        if (!live) return;
        if (!state.practiceNext.length) return leave();
        setItems(state.practiceNext);
        setPracticeNext([]);
      });
    return () => {
      live = false;
    };
    // Fetches once per round; the state read here is the state when the round starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, round]);
  if (!items) return <LessonSkeleton />;

  const today = dayKey(new Date());
  const streak = visibleStreak(state.progress.streak, today);
  return (
    <LessonPlayer
      key={round}
      steps={items.map((i) => i.step) as unknown as Step[]}
      onClose={leave}
      onStep={(index, missed) => {
        const ref = items[index]?.ref;
        if (ref) answerReview(ref, missed);
      }}
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
                setItems(null);
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
