"use client";

import { Card } from "@/components/ui/Card";
import { classReport, overallGpa, GRADE_TONE, type ReportClass } from "@/features/dashboard/reportCard";
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
  const reports = classes.map((c) => classReport(c, records, graduated)).filter((r) => r.attempted > 0);

  if (!reports.length) {
    return (
      <Card>
        <p className="py-3 text-center text-sm font-semibold text-ink-500">
          📋 Complete a lesson to start your report card.
        </p>
      </Card>
    );
  }

  const gpa = overallGpa(reports);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-dashed border-hairline pb-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Report Card</p>
          <p className="text-2xl font-extrabold text-ink">
            GPA {gpa.toFixed(2)}
            <span className="text-sm font-bold text-ink-500"> / 4.0</span>
          </p>
        </div>
        <span className="text-3xl">🎓</span>
      </div>

      <div className="flex flex-col gap-2">
        {reports.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-card border border-hairline bg-surface-card/60 p-2.5">
            <span className="text-xl">{r.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-ink">{r.title}</p>
              <p className="truncate text-[11px] font-semibold text-ink-500">
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
            <span className={`shrink-0 rounded-lg px-2.5 py-1 text-base font-extrabold ${GRADE_TONE[r.grade] ?? GRADE_TONE["—"]}`}>
              {r.grade}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
