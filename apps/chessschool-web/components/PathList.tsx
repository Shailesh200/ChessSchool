"use client";

import { copy, focusCourse, guestClassCap, guestUnitBlocked, lessonAccess, type CourseLesson, type Progress } from "@chessschool/design";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./Icon";
import { CourseSkeleton } from "./Skeleton";
import { Button, Sheet } from "./ui";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";

const href = (id: string) => (id === "meet" ? "/orientation" : `/lesson/${id}`);

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

export function PathList({ progress, onGate }: { progress: Progress; onGate?: () => void }) {
  const course = useCourse();
  const { state } = useApp();
  const [review, setReview] = useState(false);
  const [all, setAll] = useState(false);
  if (!course) return <CourseSkeleton />;
  const cap = state.account ? null : guestClassCap(course);
  const f = focusCourse(course, progress.completed);
  const unitName = (id: string) => course.units.find((u) => u.id === id)?.title ?? "";
  const gated = (lesson: CourseLesson) => guestUnitBlocked(course, lesson.unit, cap);
  const openGate = () => onGate?.();
  return (
    <div className="focus">
      <div className="focus-head">
        <p className="focus-meta">{copy.today.focus.progress(f.unitsDone.length, f.unitCount, f.doneCount)}</p>
        {f.currentUnit ? <span className="focus-chip">{copy.today.focus.active(f.currentUnit.title)}</span> : null}
      </div>
      {f.doneCount > 1 ? (
        <div className="focus-earlier">
          <span className="focus-dot done" aria-hidden>
            <Icon name="check" size={16} />
          </span>
          <div>
            <strong>{copy.today.focus.earlier(f.doneCount)}</strong>
            <p>{f.unitsDone.map((u) => u.title.replace(/^Unit \d+ · /, "")).join(", ")}</p>
          </div>
          <button type="button" className="link-more" onClick={() => setReview((v) => !v)}>
            {review ? copy.today.focus.hide : copy.today.focus.review}
          </button>
        </div>
      ) : null}
      {review ? (
        <ul className="focus-rest">
          {f.done.map((l) => (
            <li key={l.id}>
              <Link href={href(l.id)}>{l.title}</Link>
            </li>
          ))}
        </ul>
      ) : null}
      <ol className="focus-rail">
        {f.justFinished ? <Stop kind="done" lesson={f.justFinished} unit={unitName(f.justFinished.unit)} kicker={copy.today.focus.justFinished} /> : null}
        {f.current ? (
          <Stop
            kind={gated(f.current) ? "gated" : "current"}
            lesson={f.current}
            unit={unitName(f.current.unit)}
            kicker={copy.today.focus.current}
            onGate={openGate}
          />
        ) : null}
        {f.upcoming.map((l, i) => (
          <Stop
            key={l.id}
            kind={gated(l) ? "gated" : lessonAccess(course, progress.completed, l.id) === "current" ? "current" : "locked"}
            lesson={l}
            unit={unitName(l.unit)}
            kicker={i === 0 ? copy.today.focus.upNext : undefined}
            onGate={openGate}
          />
        ))}
      </ol>
      {f.rest.length ? (
        <div className="focus-more">
          <div>
            <strong>{copy.today.focus.more(f.rest.length)}</strong>
            <p>{[...new Set(f.rest.map((l) => unitName(l.unit).replace(/^Unit \d+ · /, "")))].join(", ")}</p>
          </div>
          <button type="button" className="link-more" onClick={() => setAll((v) => !v)}>
            {all ? copy.today.focus.showLess : copy.today.focus.viewAll}
          </button>
        </div>
      ) : null}
      {all ? (
        <ul className="focus-rest">
          {f.rest.map((l) => (
            <li key={l.id}>
              {gated(l) ? (
                <button type="button" onClick={openGate}>
                  {l.title}
                  <span>{copy.lesson.locked}</span>
                </button>
              ) : lessonAccess(course, progress.completed, l.id) === "locked" ? (
                <span className="focus-locked">
                  {l.title}
                  <span>{copy.lesson.locked}</span>
                </span>
              ) : (
                <Link href={href(l.id)}>
                  {l.title}
                  <span>{copy.today.open(l.minutes)}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {!f.current ? <p className="focus-meta">{copy.today.heroAllBody}</p> : null}
    </div>
  );
}

function Stop({
  kind,
  lesson,
  unit,
  kicker,
  onGate,
}: {
  kind: "done" | "current" | "locked" | "gated";
  lesson: CourseLesson;
  unit: string;
  kicker?: string;
  onGate?: () => void;
}) {
  const body = (
    <>
      {kicker ? <span className="focus-kicker">{kicker}</span> : null}
      <span className="focus-unit">{unit}</span>
      <strong>{lesson.title}</strong>
      <span className="path-sub">{kind === "done" ? `${copy.today.done} · +${lesson.xp} XP` : kind === "locked" || kind === "gated" ? copy.lesson.locked : `${lesson.sub} · ${lesson.minutes} min`}</span>
    </>
  );
  const card = kind === "gated" ? (
    <button type="button" className="focus-card" onClick={onGate}>
      {body}
      <Icon name="lock" className="focus-chevron" />
    </button>
  ) : (
    <div className="focus-card">{body}</div>
  );
  return (
    <li className={`focus-stop is-${kind === "gated" ? "locked" : kind}`}>
      <span className={`focus-dot ${kind === "gated" ? "locked" : kind}`} aria-hidden>
        {kind === "done" ? <Icon name="check" size={16} /> : kind === "current" ? (
          <>
            <Icon name="play" size={14} />
            <span className="focus-start">{copy.today.focus.start}</span>
          </>
        ) : (
          <Icon name="lock" size={14} />
        )}
      </span>
      {card}
    </li>
  );
}
