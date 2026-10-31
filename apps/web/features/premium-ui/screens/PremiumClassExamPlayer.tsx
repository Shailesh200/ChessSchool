"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LessonPlayer } from "@/features/lessons/LessonPlayer";
import type { Lesson } from "@/features/lessons/types";
import { usePremiumUi } from "@/features/premium-ui/usePremiumUi";
import { useMidnightSurface } from "@/features/premium-ui/useMidnightSurface";

export function PremiumClassExamPlayer({
  lesson,
  nextLessonId,
  lessonClass,
  classTitle,
  puzzleCount,
  currentPuzzle = 1,
}: {
  lesson: Lesson;
  nextLessonId: string | null;
  lessonClass: { id: string; title: string; lessonIds: string[] };
  classTitle: string;
  puzzleCount: number;
  currentPuzzle?: number;
}) {
  const theme = useMidnightSurface();
  const premium = usePremiumUi();

  useEffect(() => {
    if (!premium) return;
    document.body.dataset.screen = "exam";
    return () => {
      if (document.body.dataset.screen === "exam") delete document.body.dataset.screen;
    };
  }, [premium]);

  if (!premium) {
    return (
      <LessonPlayer
        lesson={lesson}
        nextLessonId={nextLessonId}
        lessonClass={lessonClass}
      />
    );
  }

  const pips = Array.from({ length: puzzleCount }, (_, i) => i + 1);

  return (
    <div className="premium-exam-shell" data-theme={theme}>
      <div className="lh" data-center="lh">
        <div className="cs-lessonhead">
          <Link className="cs-iconbtn" href={`/class/${lessonClass.id}`} aria-label="Close exam">
            ×
          </Link>
          <h2 className="cs-h4">Class exam</h2>
          <div className="pips" role="img" aria-label={`Puzzle ${currentPuzzle} of ${puzzleCount}`}>
            {pips.map((n) => (
              <i key={n} className={n < currentPuzzle ? "d" : n === currentPuzzle ? "c" : ""} />
            ))}
          </div>
        </div>
      </div>
      <div className="lgrid" data-center="lgrid">
        <div className="lcoach">
          <div className="ttl">
            <span className="cs-tag">
              {classTitle} · puzzle {currentPuzzle} of {puzzleCount}
            </span>
            <h2 className="cs-h3">{lesson.title}</h2>
          </div>
          <div className="cs-coach">
            <span className="cs-avatar cs-avatar--lg t-otto m-neutral">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kit/accents/otto/thinking.webp" alt="Otto" />
            </span>
            <div className="cs-bubble cs-bubble--strong">
              No hints in the exam. Pass mark: about two-thirds of puzzles.
            </div>
          </div>
        </div>
      </div>
      <LessonPlayer lesson={lesson} nextLessonId={nextLessonId} lessonClass={lessonClass} />
    </div>
  );
}
