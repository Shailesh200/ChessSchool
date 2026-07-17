"use client";

import { use, useEffect, useState } from "react";
import { LessonPlayer } from "@/features/lessons/LessonPlayer";
import { Icon } from "@/components/ui/Icon";
import { STAGES } from "@/content/school";
import type { Lesson, LessonStep } from "@/features/lessons/types";

/** School exam — random puzzles from across the school; passing unlocks the next. */
export default function SchoolExamPage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
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
      <div className="bg-surface text-ink-500 flex min-h-dvh items-center justify-center text-sm font-bold">
        Building your exam…
      </div>
    );
  }
  if (!steps.length) {
    return (
      <div className="bg-surface flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <Icon name="journal" size={40} className="text-brand" duotone />
        <p className="text-ink-500 text-sm font-bold">
          No exam is available for this school yet.
        </p>
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

  return (
    <LessonPlayer
      key={`school-exam-${stage}`}
      lesson={lesson}
      nextLessonId={null}
      schoolExam={{ stage, nextName }}
    />
  );
}
