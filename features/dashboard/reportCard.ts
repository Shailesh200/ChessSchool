import type { LessonRecord } from "@/core/store/progression.store";

export interface ReportClass {
  id: string;
  title: string;
  emoji: string;
  semesterTitle: string;
  stage: string;
  lessonIds: string[];
}

export interface ClassReport {
  id: string;
  title: string;
  emoji: string;
  semesterTitle: string;
  completed: number;
  total: number;
  attempted: number;
  avgStars: number; // 0..3
  accuracy: number; // 0..1
  grade: string;
  passed: boolean;
}

/** 0–3 stars for one lesson from its mastery + mistakes (best run). */
export function lessonStars(rec?: LessonRecord): 0 | 1 | 2 | 3 {
  if (!rec || rec.mastery <= 0) return 0;
  const inc = rec.incorrect ?? 0;
  if (rec.mastery >= 0.85 && inc === 0) return 3;
  if (rec.mastery >= 0.6 && inc <= 2) return 2;
  return 1;
}

export function gradeFor(avgStars: number): string {
  if (avgStars >= 2.6) return "A+";
  if (avgStars >= 2.2) return "A";
  if (avgStars >= 1.7) return "B";
  if (avgStars >= 1.2) return "C";
  if (avgStars > 0) return "D";
  return "—";
}

export const GRADE_TONE: Record<string, string> = {
  "A+": "bg-success/15 text-success",
  A: "bg-success/15 text-success",
  B: "bg-brand-50 text-brand",
  C: "bg-warning/20 text-warning",
  D: "bg-danger/15 text-danger",
  "—": "bg-surface-sunken text-ink-500",
};

/** Build a report for one class from the local lesson records. */
export function classReport(
  cls: ReportClass,
  records: Record<string, LessonRecord>,
  graduated: string[],
): ClassReport {
  const ids = cls.lessonIds;
  const attempted = ids.filter((id) => (records[id]?.mastery ?? 0) > 0);
  const completed = ids.filter((id) => (records[id]?.mastery ?? 0) >= 0.9).length;
  const avgStars = attempted.length
    ? attempted.reduce((a, id) => a + lessonStars(records[id]), 0) / attempted.length
    : 0;
  const accuracy = attempted.length
    ? attempted.reduce((a, id) => a + (records[id]?.mastery ?? 0), 0) / attempted.length
    : 0;
  return {
    id: cls.id,
    title: cls.title,
    emoji: cls.emoji,
    semesterTitle: cls.semesterTitle,
    completed,
    total: ids.length,
    attempted: attempted.length,
    avgStars,
    accuracy,
    grade: gradeFor(avgStars),
    passed: graduated.includes(cls.id),
  };
}

/** GPA-style overall average across graded classes (0..4). */
export function overallGpa(reports: ClassReport[]): number {
  const graded = reports.filter((r) => r.attempted > 0);
  if (!graded.length) return 0;
  return graded.reduce((a, r) => a + r.avgStars / 3 * 4, 0) / graded.length;
}
