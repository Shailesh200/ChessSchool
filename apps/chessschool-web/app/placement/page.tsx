"use client";

import type { Step } from "@chessschool/chess";
import { copy, placementStart } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LessonDone } from "@/components/LessonDone";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button } from "@/components/ui";
import { LessonSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";

type Item = { lesson: string; step: Step };

/** Eight positions of rising difficulty; the first miss decides where the course starts. */
export default function PlacementPage() {
  const { ready, placeBefore, cue } = useApp();
  const course = useCourse();
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [start, setStart] = useState<string | null | undefined>(undefined);
  const firstMiss = useRef<number | null>(null);

  useEffect(() => {
    api
      .placement()
      .then((r) => (r.items.length ? setItems(r.items as unknown as Item[]) : router.replace("/today")))
      .catch(() => router.replace("/today"));
  }, [router]);
  if (!ready || !items || !course) return <LessonSkeleton />;

  const order = course.lessons.map((l) => l.id);
  const title = start ? (course.lessons.find((l) => l.id === start)?.title ?? start) : null;
  return (
    <LessonPlayer
      steps={items.map((i) => i.step)}
      closeHref="/today"
      onStep={(index, missed) => {
        if (missed && firstMiss.current === null) firstMiss.current = index;
      }}
      onFinished={() => {
        const at = placementStart(order, items.map((i) => i.lesson), firstMiss.current);
        // Missing the first item means starting from the very beginning: nothing to mark.
        if (at && firstMiss.current !== 0) placeBefore(order, at);
        setStart(firstMiss.current === 0 ? null : at);
        cue("level-up");
      }}
      done={
        start !== undefined ? (
          <LessonDone title={copy.placement.quizDoneTitle} body={title ? copy.placement.quizDone(title) : firstMiss.current === 0 ? copy.placement.quizFirst : copy.placement.quizAll}>
            <Button block icon="arrowRight" href="/today">
              {copy.placement.quizStart}
            </Button>
          </LessonDone>
        ) : null
      }
    />
  );
}
