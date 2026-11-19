"use client";

import { copy, focusCourse, isGuestLockedLesson, type Progress } from "@chessschool/design";
import { PieceArt } from "./Board";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
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
  const { state, showGuestGate } = useApp();
  if (!course) return <CourseSkeleton />;
  const f = focusCourse(course, progress.completed);
  const share = f.doneCount / Math.max(1, course.lessons.length);
  const unitIndex = f.currentUnit ? course.units.findIndex((u) => u.id === f.currentUnit!.id) : -1;
  const unitLessons = f.currentUnit ? course.lessons.filter((l) => l.unit === f.currentUnit!.id) : [];
  const nextUnits = unitIndex >= 0 ? course.units.slice(unitIndex + 1, unitIndex + 3) : [];
  const short = (title: string) => title.replace(/^Unit \d+ · /, "");
  const lessonHref = (id: string) => (id === "meet" ? "/orientation" : `/lesson/${id}`);
  return (
    <section className="focus" aria-labelledby="path-title">
      <div className="course-top">
        <h2 id="path-title" className="eyebrow">
          {copy.today.pathTitle}
        </h2>
        <span className="course-through">{copy.today.through(Math.round(share * 100))}</span>
      </div>
      {f.current && f.currentUnit ? (
        <div className="card course-hero">
          <div className="course-hero-art">
            <Cody animation="idle" size={128} className="course-hero-cody" />
            <div>
              <span className="course-hero-unit">{copy.today.unitLabel(unitIndex + 1)}</span>
              <strong>{short(f.currentUnit.title)}</strong>
            </div>
          </div>
          <div className="course-hero-body">
            <ol className="course-dots" aria-label={copy.today.unitDots(unitLessons.filter((l) => progress.completed[l.id]).length, unitLessons.length)}>
              {unitLessons.map((l) => (
                <li key={l.id} className={progress.completed[l.id] ? "is-done" : l.id === f.current!.id ? "is-now" : ""} aria-current={l.id === f.current!.id ? "step" : undefined}>
                  <span aria-hidden>{progress.completed[l.id] ? <Icon name="check" size={16} /> : l.id === f.current!.id ? <Icon name="play" size={14} /> : null}</span>
                </li>
              ))}
            </ol>
            <div className="course-next">
              <span className="muted small">{copy.today.upNext}</span>
              <strong>{f.current.title}</strong>
            </div>
            {isGuestLockedLesson(f.current) && !state.account ? (
              <Button block icon="play" onClick={showGuestGate}>
                {copy.today.continueLesson}
              </Button>
            ) : (
              <Button block icon="play" href={lessonHref(f.current.id)}>
                {copy.today.continueLesson}
              </Button>
            )}
          </div>
        </div>
      ) : null}
      {nextUnits.length ? (
        <div className="course-next-units">
          <span className="course-label">{copy.today.nextUnits}</span>
          <ul>
            {nextUnits.map((u, i) => (
              <li key={u.id} className="card">
                <PieceArt piece={{ type: (["b", "r", "q", "k", "n", "p"] as const)[(unitIndex + i) % 6], color: "b" }} size={26} />
                <strong>{short(u.title)}</strong>
                <span className="muted small">{copy.today.unitLabel(unitIndex + i + 2)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <span className="course-label">{copy.today.courseMap}</span>
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
    </section>
  );
}

