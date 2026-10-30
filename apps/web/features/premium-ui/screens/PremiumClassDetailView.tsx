"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { isUnlocked } from "@/features/lessons/unlock";
import { isClassUnlocked, type SchoolClass } from "@/features/school/structure";
import { useProgression } from "@/core/store/progression.store";
import { startNav } from "@/core/store/nav.store";
import { haptics } from "@/core/haptics/haptics";

type LessonLite = { id: string; title: string; subtitle: string; emoji: string };

export function PremiumClassDetailView({
  cls,
  lessons,
  examLesson,
  allClasses,
}: {
  cls: { id: string; title: string; emoji: string; blurb: string; examId?: string };
  lessons: LessonLite[];
  examLesson: { id: string; title: string } | null;
  allClasses: SchoolClass[];
}) {
  const router = useRouter();
  const records = useProgression((s) => s.lessons);
  const graduated = useProgression((s) => s.graduatedClasses);
  const unlockedClass = isClassUnlocked(cls.id, records, graduated, allClasses);

  return (
    <section className="screen on" data-screen="class">
      <div className="back">
        <Link className="cs-iconbtn" href="/academy" aria-label="Back to course map">
          ←
        </Link>
        <span className="over">Class</span>
      </div>
      <div className="hdr">
        <h1 className="cs-h1">{cls.title}</h1>
        <p className="muted">{cls.blurb}</p>
        <div className="cs-chiprow" style={{ marginTop: ".5rem" }}>
          <span className="cs-tag">{lessons.length} lessons</span>
          {examLesson && <span className="cs-tag cs-tag--accent">Class exam</span>}
        </div>
      </div>
      <div className="cs-list">
        {lessons.map((lesson, index) => {
          const mastery = records[lesson.id]?.mastery ?? 0;
          const locked = !unlockedClass || !isUnlocked(lesson.id, records);
          const done = mastery >= 0.9;
          const current = !locked && !done;
          return (
            <button
              key={lesson.id}
              type="button"
              className={`cs-row${current ? " cur-row" : ""}`}
              disabled={locked}
              onClick={() => {
                haptics.fire("select");
                startNav();
                router.push(`/lesson/${lesson.id}`);
              }}
            >
              <div className={`cs-row__tile${done ? " tile-done" : locked ? " tile-lock" : " cs-row__tile--accent"}`}>
                {done ? "✓" : index + 1}
              </div>
              <div className="cs-row__body">
                <b>
                  {index + 1} · {lesson.title}
                </b>
                <span>
                  {done ? `Done · ${Math.round(mastery * 100)}%` : locked ? "Locked" : "Up next"}
                </span>
              </div>
            </button>
          );
        })}
        {examLesson && (
          <Link href={`/class/${cls.id}/exam`} className="cs-row">
            <div className="cs-row__tile tile-lock">🎓</div>
            <div className="cs-row__body">
              <b>Class exam</b>
              <span>{examLesson.title}</span>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}
