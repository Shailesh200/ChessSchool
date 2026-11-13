"use client";

import { copy, focusCourse, type CourseLesson, type Progress } from "@chessschool/design";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { CourseSkeleton } from "./Skeleton";
import { useCourse } from "@/lib/course";

const href = (id: string) => (id === "meet" ? "/orientation" : `/lesson/${id}`);

export function PathList({ progress }: { progress: Progress }) {
  const course = useCourse();
  const [review, setReview] = useState(false);
  const [all, setAll] = useState(false);
  if (!course) return <CourseSkeleton />;
  const f = focusCourse(course, progress.completed);
  const unitName = (id: string) => course.units.find((u) => u.id === id)?.title ?? "";
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
        {f.current ? <Stop kind="current" lesson={f.current} unit={unitName(f.current.unit)} kicker={copy.today.focus.current} /> : null}
        {f.upcoming.map((l, i) => (
          <Stop key={l.id} kind="next" lesson={l} unit={unitName(l.unit)} kicker={i === 0 ? copy.today.focus.upNext : undefined} />
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
              <Link href={href(l.id)}>
                {l.title}
                <span>{copy.today.open(l.minutes)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
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
      {!f.current ? <p className="focus-meta">{copy.today.heroAllBody}</p> : null}
    </div>
  );
}

function Stop({ kind, lesson, unit, kicker }: { kind: "done" | "current" | "next"; lesson: CourseLesson; unit: string; kicker?: string }) {
  const body = (
    <>
      {kicker ? <span className="focus-kicker">{kicker}</span> : null}
      <span className="focus-unit">{unit}</span>
      <strong>{lesson.title}</strong>
      <span className="path-sub">{kind === "done" ? `${copy.today.done} · +${lesson.xp} XP` : `${lesson.sub} · ${lesson.minutes} min`}</span>
      {kind === "current" ? (
        <span className="focus-go">
          <Button href={href(lesson.id)} icon="play">
            {lesson.id === "meet" ? copy.today.heroCta : copy.today.heroCtaLesson}
          </Button>
        </span>
      ) : null}
    </>
  );
  return (
    <li className={`focus-stop is-${kind}`}>
      <span className={`focus-dot ${kind}`} aria-hidden>
        {kind === "done" ? <Icon name="check" size={16} /> : kind === "current" ? <Icon name="play" size={14} /> : null}
      </span>
      {kind === "next" ? (
        <Link href={href(lesson.id)} className="focus-card">
          {body}
          <Icon name="chevron" className="focus-chevron" />
        </Link>
      ) : (
        <div className="focus-card">{body}</div>
      )}
    </li>
  );
}
