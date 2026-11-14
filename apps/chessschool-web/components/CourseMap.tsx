"use client";

import { copy, courseTrail, isGuestLockedLesson, type Course, type Progress, type TrailStop } from "@chessschool/design";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";

const ROW = 104;
/** Node centre in % of the width; follows the absolute unit index so the trail keeps its shape when the window moves. */
const xAt = (i: number) => 50 + 26 * Math.sin(i * 1.1);
const short = (t: string) => t.replace(/^(Unit|यूनिट) \d+ · /, "");
const href = (id: string) => (id === "meet" ? "/orientation" : `/lesson/${id}`);
const stateText = (s: TrailStop) => (s.state === "done" ? copy.today.done : s.state === "current" ? copy.today.focus.current : copy.lesson.locked);

/** The course as a winding trail, one stop per unit. Shows a window around the current unit until "View all". */
export function CourseMap({ course, progress, onGate }: { course: Course; progress: Progress; onGate: () => void }) {
  const [all, setAll] = useState(false);
  const trail = courseTrail(course, progress.completed);
  const at = trail.findIndex((s) => s.state === "current");
  const from = all ? 0 : Math.max(0, (at < 0 ? trail.length : at) - 2);
  const stops = all ? trail : trail.slice(from, from + 8);
  const pts = stops.map((_, k) => [xAt(from + k), k * ROW + ROW / 2] as const);
  const path = (n: number) => pts.slice(0, n).map(([x, y], k) => (k ? `C ${pts[k - 1][0]} ${y - ROW / 2} ${x} ${pts[k - 1][1] + ROW / 2} ${x} ${y}` : `M ${x} ${y}`)).join(" ");
  const reached = stops.filter((s) => s.state !== "locked").length;
  const height = stops.length * ROW;
  return (
    <div className="cmap">
      <div className="cmap-trail" style={{ height }}>
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
          <path d={path(stops.length)} className="cmap-road" vectorEffect="non-scaling-stroke" />
          {reached > 1 ? <path d={path(reached)} className="cmap-road done" vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        <ol>
          {stops.map((s, k) => {
            const [x, y] = pts[k];
            const label = copy.today.focus.map.stop(short(s.unit.title), s.done, s.total, stateText(s));
            const node = (
              <span className={`cmap-node ${s.state}`} aria-hidden>
                {s.state === "current" ? <Cody size={64} /> : <Icon name={s.state === "done" ? "check" : "lock"} size={s.state === "done" ? 22 : 18} />}
              </span>
            );
            const gated = s.lesson && isGuestLockedLesson(s.lesson);
            return (
              <li key={s.unit.id} className="cmap-stop" style={{ left: `${x}%`, top: y }}>
                {s.lesson === null ? (
                  <span role="img" aria-label={label}>
                    {node}
                  </span>
                ) : gated ? (
                  <button type="button" aria-label={label} onClick={onGate}>
                    {node}
                  </button>
                ) : (
                  <Link href={href(s.lesson.id)} aria-label={label}>
                    {node}
                  </Link>
                )}
                <span className={`cmap-label ${x >= 50 ? "left" : "right"} ${s.state}`} aria-hidden>
                  {s.state === "current" ? <span className="focus-kicker">{copy.today.focus.current}</span> : null}
                  <strong>{short(s.unit.title)}</strong>
                  <span>{s.state === "current" && s.lesson ? s.lesson.title : `${s.done}/${s.total}`}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {trail.length > 8 ? (
        <button type="button" className="link-more" onClick={() => setAll((v) => !v)}>
          {all ? copy.today.focus.showLess : copy.today.focus.viewAll}
        </button>
      ) : null}
    </div>
  );
}
