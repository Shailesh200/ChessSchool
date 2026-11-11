import { copy } from "@chessschool/design";

export function CourseSkeleton() {
  return (
    <div className="path-skeleton" aria-busy="true" aria-label={copy.today.focus.loading}>
      <span className="skel-line" />
      <span className="skel" />
      <span className="skel is-short" />
      <span className="skel is-short" />
    </div>
  );
}

export function LessonSkeleton() {
  return (
    <div className="lesson-skeleton" aria-busy="true" aria-label={copy.today.focus.loading}>
      <span className="skel-line" />
      <span className="skel is-board" />
      <span className="skel" />
    </div>
  );
}
