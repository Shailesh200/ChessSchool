"use client";

import { use, useEffect, useState } from "react";
import { LessonPlayer } from "@/features/lessons/LessonPlayer";
import { STAGES } from "@/content/school";
import type { Lesson, LessonStep } from "@/features/lessons/types";

/** School exam — random puzzles from across the school; passing unlocks the next. */
export default function SchoolExamPage({ params }: { params: Promise<{ stage: string }> }) {
  const { stage } = use(params);
  const [steps, setSteps] = useState<LessonStep[] | null>(null);

  useEffect(() => {
    fetch(`/api/school-exam?stage=${stage}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSteps((d?.steps as LessonStep[]) ?? []))
      .catch(() => setSteps([]));
  }, [stage]);

  const idx = STAGES.findIndex((s) => s.id === stage);
  const stageName = STAGES[idx]?.name ?? "School";
  const nextName = STAGES[idx + 1]?.name ?? "the next school";

  if (steps === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface text-sm font-bold text-ink-500">
        Building your exam…
      </div>
    );
  }
  if (!steps.length) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-surface px-6 text-center">
        <p className="text-2xl">📝</p>
        <p className="text-sm font-bold text-ink-500">No exam is available for this school yet.</p>
      </div>
    );
  }

  const lesson: Lesson = {
    id: `school-exam-${stage}`,
    unit: stage,
    title: `${stageName} Exam`,
    subtitle: "Pass to unlock the next school",
    emoji: "📝",
    prerequisites: [],
    xp: 60,
    tag: "exam",
    exam: true,
    steps,
  };

  return <LessonPlayer lesson={lesson} nextLessonId={null} schoolExam={{ stage, nextName }} />;
}
