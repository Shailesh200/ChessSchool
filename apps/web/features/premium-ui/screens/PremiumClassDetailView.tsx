"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
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

  const classIndex = allClasses.findIndex((c) => c.id === cls.id);
  const classLabel =
    classIndex >= 0 ? `Class ${classIndex + 1} of ${allClasses.length}` : "Class";

  const nextLesson = useMemo(() => {
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i]!;
      const mastery = records[lesson.id]?.mastery ?? 0;
      const locked = !unlockedClass || !isUnlocked(lesson.id, records);
      if (!locked && mastery < 0.9) return { lesson, index: i };
    }
    return null;
  }, [lessons, records, unlockedClass]);

  useEffect(() => {
    document.body.dataset.screen = "class";
    return () => {
      if (document.body.dataset.screen === "class") delete document.body.dataset.screen;
    };
  }, []);

  return (
    <section className="screen on" data-screen="class">
      <div className="back">
        <Link className="cs-iconbtn" href="/academy" aria-label="Back to course map">
          ←
        </Link>
        <span className="over">{classLabel}</span>
      </div>
      <div className="hdr">
        <h1 className="cs-h1">{cls.title}</h1>
        <p className="muted">{cls.blurb}</p>
        <div className="cs-chiprow" style={{ marginTop: ".5rem" }}>
          <span className="cs-tag">{lessons.length} lessons</span>
          {examLesson && (
            <span className="cs-tag cs-tag--accent">
              {Math.min(6, lessons.length)} puzzles · 20 XP
            </span>
          )}
        </div>
      </div>
      <div className="twocol">
        <div className="cs-list">
          {lessons.map((lesson, index) => {
            const mastery = records[lesson.id]?.mastery ?? 0;
            const locked = !unlockedClass || !isUnlocked(lesson.id, records);
            const done = mastery >= 0.9;
            const current = !locked && !done && nextLesson?.lesson.id === lesson.id;
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
                <div
                  className={`cs-row__tile${done ? " tile-done" : locked ? " tile-lock" : " cs-row__tile--accent"}`}
                >
                  {done ? "✓" : index + 1}
                </div>
                <div className="cs-row__body">
                  <b>
                    {index + 1} · {lesson.title}
                  </b>
                  <span>
                    {done
                      ? `Done · ${Math.round(mastery * 100)}%`
                      : locked
                        ? "Locked"
                        : current
                          ? "Up next"
                          : "Practice"}
                  </span>
                </div>
              </button>
            );
          })}
          {examLesson && (
            <Link href={`/class/${cls.id}/exam`} className="cs-row">
              <div className="cs-row__tile tile-exam">🎓</div>
              <div className="cs-row__body">
                <b>Class exam</b>
                <span>Pass with 67% to graduate</span>
              </div>
            </Link>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="cs-card cs-stack">
            <div className="over">Skills in this class</div>
            <div className="mast">
              <div className="mt">
                <b>{cls.title}</b>
              </div>
              <div className="mb">
                <div
                  className="cs-progress cs-progress--thin cs-progress--brand"
                  role="progressbar"
                  aria-label="Class progress"
                  aria-valuenow={Math.round(
                    (lessons.filter((l) => (records[l.id]?.mastery ?? 0) >= 0.9).length /
                      Math.max(1, lessons.length)) *
                      100,
                  )}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  style={{
                    ["--v" as string]: `${Math.round(
                      (lessons.filter((l) => (records[l.id]?.mastery ?? 0) >= 0.9).length /
                        Math.max(1, lessons.length)) *
                        100,
                    )}%`,
                  }}
                >
                  <i />
                </div>
              </div>
            </div>
          </div>
          {nextLesson ? (
            <button
              type="button"
              className="cs-btn cs-btn--accent cs-btn--block"
              onClick={() => {
                haptics.fire("select");
                startNav();
                router.push(`/lesson/${nextLesson.lesson.id}`);
              }}
            >
              Start lesson {nextLesson.index + 1}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
