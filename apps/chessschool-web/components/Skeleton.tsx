"use client";

import { copy } from "@chessschool/design";
import { Cody } from "./Lottie";

/** Page move: Cody, the current coach, not the old shimmer board. */
export function CourseSkeleton() {
  return (
    <div className="route-loader" aria-busy="true" aria-label={copy.today.focus.loading}>
      <Cody animation="reading" size={120} />
      <p>{copy.today.focus.loading}</p>
    </div>
  );
}

export function LessonSkeleton() {
  return (
    <div className="route-loader" aria-busy="true" aria-label={copy.today.focus.loading}>
      <Cody animation="thinking" size={120} />
      <p>{copy.today.focus.loading}</p>
    </div>
  );
}
