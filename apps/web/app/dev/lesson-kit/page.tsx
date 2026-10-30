"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LessonPlayer, LessonComplete } from "@/features/lessons/LessonPlayer";
import { LESSON_KIT_DEV_FIXTURES } from "@/features/lessons/lessonKitDevFixtures";

const SCREENS = ["05a", "05b", "05c", "05d", "06a", "06b", "07", "08"] as const;

function LessonKitDevInner() {
  const params = useSearchParams();
  const raw = params.get("screen") ?? "05a";
  const screen = (SCREENS.includes(raw as (typeof SCREENS)[number]) ? raw : "05a") as
    | (typeof SCREENS)[number];
  const fixture = LESSON_KIT_DEV_FIXTURES[screen];

  if (fixture.complete) {
    return (
      <LessonComplete
        lesson={fixture.lesson}
        correct={2}
        mistakes={0}
        ceremony={null}
        durationMs={125_000}
        hintsUsed={1}
        interactiveSteps={2}
        onDone={() => void 0}
      />
    );
  }

  return (
    <div data-testid={`lesson-kit-dev-${screen}`}>
      <LessonPlayer lesson={fixture.lesson} devPreview={fixture.preview} />
    </div>
  );
}

/** Dev-only kit lesson screens for 390 / 1280 QA (not linked in prod nav). */
export default function LessonKitDevPage() {
  return (
    <Suspense fallback={null}>
      <LessonKitDevInner />
    </Suspense>
  );
}
