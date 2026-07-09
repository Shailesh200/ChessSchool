"use client";

import { Card } from "@/components/ui/Card";
import {
  classReport,
  overallGpa,
  GRADE_TONE,
  type ReportClass,
} from "@/features/dashboard/reportCard";
import type { LessonRecord } from "@/core/store/progression.store";

/** Student report card — per-class grades from the local lesson records. */
export function ReportCard({
  classes,
  records,
  graduated,
}: {
  classes: ReportClass[];
  records: Record<string, LessonRecord>;
  graduated: string[];
}) {
  const reports = classes
    .map((c) => classReport(c, records, graduated))
    .filter((r) => r.attempted > 0);

  if (!reports.length) {
    return (
      <Card>
        <p className="text-ink-500 py-3 text-center text-sm font-semibold">
          📋 Complete a lesson to start your report card.
        </p>
      </Card>
    );
  }

  const gpa = overallGpa(reports);
  return (
    <Card className="flex flex-col gap-3">
      <div className="border-hairline flex items-center justify-between border-b border-dashed pb-2">
        <div>
          <p className="text-ink-500 text-[11px] font-bold tracking-wide uppercase">
            Report Card
          </p>
          <p className="text-ink text-2xl font-extrabold">
            GPA {gpa.toFixed(2)}
            <span className="text-ink-500 text-sm font-bold"> / 4.0</span>
          </p>
        </div>
        <span className="text-3xl">🎓</span>
      </div>

      <div className="flex flex-col gap-2">
        {reports.map((r) => (
          <div
            key={r.id}
            className="rounded-card border-hairline bg-surface-card/60 flex items-center gap-3 border p-2.5"
          >
            <span className="text-xl">{r.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-ink truncate text-sm font-extrabold">{r.title}</p>
              <p className="text-ink-500 truncate text-[11px] font-semibold">
                {r.completed}/{r.total} done · {Math.round(r.accuracy * 100)}% accuracy
                {r.passed ? " · ✓ passed" : ""}
              </p>
              <div className="mt-0.5 text-[11px] leading-none">
                {[1, 2, 3].map((s) => (
                  <span key={s} className={r.avgStars >= s - 0.4 ? "" : "opacity-20"}>
                    ⭐
                  </span>
                ))}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1 text-base font-extrabold ${GRADE_TONE[r.grade] ?? GRADE_TONE["—"]}`}
            >
              {r.grade}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
