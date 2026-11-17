"use client";

import { copy, focusCourse, type Progress } from "@chessschool/design";
import { CourseSkeleton } from "./Skeleton";
import { CourseMap } from "./CourseMap";
import { Button, Sheet } from "./ui";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";


export function GuestGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="guest-gate-title">
      <h2 id="guest-gate-title">{copy.today.guestGate.title}</h2>
      <p>{copy.today.guestGate.body}</p>
      <Button href="/signup" block>
        {copy.today.guestGate.enroll}
      </Button>
      <Button href="/login" variant="secondary" block>
        {copy.today.guestGate.login}
      </Button>
    </Sheet>
  );
}

/** One enroll sheet for a guest-locked lesson, a refused lesson fetch, or a refused progress save. */
export function GuestGateHost() {
  const { guestGateOpen, hideGuestGate } = useApp();
  return <GuestGate open={guestGateOpen} onClose={hideGuestGate} />;
}

export function PathList({ progress }: { progress: Progress }) {
  const course = useCourse();
  const { showGuestGate } = useApp();
  if (!course) return <CourseSkeleton />;
  const f = focusCourse(course, progress.completed);
  return (
    <div className="focus">
      <div className="focus-head">
        <p className="focus-meta">{copy.today.focus.progress(f.unitsDone.length, f.unitCount, f.doneCount)}</p>
        {f.currentUnit ? <span className="focus-chip">{copy.today.focus.active(f.currentUnit.title)}</span> : null}
      </div>
      <CourseMap course={course} progress={progress} onGate={showGuestGate} />
      <div className="focus-soon">
        <strong>{copy.today.comingSoonTitle}</strong>
        <p>{copy.today.comingSoonBody}</p>
        <ul>
          {(course.comingSoon ?? copy.comingSoon).map((item) => (
            <li key={item.id}>
              {item.title}
              <span>{item.sub}</span>
            </li>
          ))}
        </ul>
      </div>
      {course && !f.current ? <p className="focus-meta">{copy.today.heroAllBody}</p> : null}
    </div>
  );
}

