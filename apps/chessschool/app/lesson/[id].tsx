import { LESSONS } from "@chessschool/chess";
import { copy, dayKey, goalMet, nextNode, nodeState, PATH, visibleStreak } from "@chessschool/design";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Cody } from "@/components/Lottie";
import { LessonDone } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button, Flow, T } from "@/components/ui";
import { useApp } from "@/lib/state";

type Before = { id: string; done: boolean; streak: number; goal: boolean };

const close = () => (router.canGoBack() ? router.back() : router.replace("/today"));

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, completeLesson, cue } = useApp();
  const [before, setBefore] = useState<Before | null>(null);
  const lesson = LESSONS[id];
  const node = PATH.find((n) => n.id === id);

  if (id === "meet") return <Redirect href="/orientation" />;
  if (!lesson || !node) return <Redirect href="/today" />;

  if (nodeState(state.progress, id) === "locked") {
    const prev = PATH[PATH.findIndex((n) => n.id === id) - 1];
    return (
      <Flow footer={<Button title={copy.lesson.back} icon="learn" onPress={close} />}>
        <Cody animation="thinking" size={160} label={copy.a11y.mascot} />
        <T role="title" header center>
          {copy.lesson.locked}
        </T>
        <T role="bodyLg" color="textMuted" center style={{ maxWidth: 340 }}>
          {copy.lesson.lockedBody(copy.path[prev.id].title)}
        </T>
      </Flow>
    );
  }

  const today = dayKey(new Date());
  const streak = visibleStreak(state.progress.streak, today);
  const b = before?.id === id ? before : null;
  const next = nextNode(state.progress);

  return (
    <LessonPlayer
      key={id}
      steps={lesson.steps}
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
            body={b.done ? copy.lesson.replayDone : next ? copy.lesson.doneNext(copy.path[next.id].title) : copy.lesson.doneLast}
            xp={b.done ? undefined : node.xp}
            streak={streak > b.streak ? streak : undefined}
            goalMet={!b.goal && goalMet(state.progress, state.profile.dailyMinutes, today)}
          >
            {next && !b.done ? <Button title={copy.lesson.nextLesson} icon="arrowRight" onPress={() => router.replace(`/lesson/${next.id}`)} /> : null}
            {!next && !b.done ? <Button title={copy.today.heroAllCta} icon="play" onPress={() => router.replace("/play")} /> : null}
            <Button title={copy.lesson.back} icon="learn" variant={!b.done ? "secondary" : "primary"} onPress={() => router.replace("/today")} />
            {!state.account ? <Button title={copy.lesson.save} icon="shield" variant="ghost" onPress={() => router.replace("/signup")} /> : null}
          </LessonDone>
        ) : null
      }
    />
  );
}
