import type { Step } from "@chessschool/chess";
import { eq } from "drizzle-orm";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CourseDoc } from "./course-check";
import type { Db } from "./db";
import { courseText } from "./schema";

/**
 * A translation of the course's words only (data/course.<lang>.json). Positions, moves and answers
 * always come from the English course, so a translation can't change the chess. Any missing line
 * falls back to English.
 */
export type StepText = { title?: string; body?: string; hint?: string; options?: string[] };
export type Named = { title?: string; sub?: string };
export type CourseText = { lang: string; units: Record<string, Named>; lessons: Record<string, Named & { steps?: StepText[] }>; comingSoon?: Record<string, Named> };

export function readCourseTexts(dir: string): CourseText[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^course\.[a-z]{2}\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as CourseText);
}

/** Problems that would make a translation point at the wrong step or answer. */
export function checkCourseText(doc: CourseDoc, t: CourseText): string[] {
  const errors: string[] = [];
  const units = new Set(doc.units.map((u) => u.id));
  for (const id of Object.keys(t.units ?? {})) if (!units.has(id)) errors.push(`${t.lang}: unknown unit ${id}`);
  const lessons = new Map(doc.lessons.map((l) => [l.id, l]));
  for (const [id, text] of Object.entries(t.lessons ?? {})) {
    const lesson = lessons.get(id);
    if (!lesson) {
      errors.push(`${t.lang}: unknown lesson ${id}`);
      continue;
    }
    if (text.steps && text.steps.length !== lesson.steps.length) errors.push(`${t.lang}: ${id} has ${text.steps.length} steps, English has ${lesson.steps.length}`);
    text.steps?.forEach((s, i) => {
      const en = lesson.steps[i] as Step | undefined;
      const opts = en && en.kind === "choice" ? en.options.length : 0;
      if (s.options && s.options.length !== opts) errors.push(`${t.lang}: ${id} step ${i + 1} has ${s.options.length} options, English has ${opts}`);
      if (s.hint && en && !("hint" in en)) errors.push(`${t.lang}: ${id} step ${i + 1} has a hint, English has none`);
    });
  }
  return errors;
}

/** Replaces one language's rows. */
export async function applyCourseText(db: Db, t: CourseText): Promise<number> {
  const rows = [
    ...Object.entries(t.units ?? {}).map(([id, v]) => ({ lang: t.lang, id: `unit:${id}`, data: JSON.stringify(v) })),
    ...Object.entries(t.lessons ?? {}).map(([id, v]) => ({ lang: t.lang, id: `lesson:${id}`, data: JSON.stringify(v) })),
    ...Object.entries(t.comingSoon ?? {}).map(([id, v]) => ({ lang: t.lang, id: `soon:${id}`, data: JSON.stringify(v) })),
  ];
  const inserts = [];
  for (let i = 0; i < rows.length; i += 200) inserts.push(db.insert(courseText).values(rows.slice(i, i + 200)));
  await db.batch([db.delete(courseText).where(eq(courseText.lang, t.lang)), ...inserts]);
  return rows.length;
}

export async function loadCourseText(db: Db, lang: string): Promise<CourseText | null> {
  const rows = await db.select().from(courseText).where(eq(courseText.lang, lang));
  if (!rows.length) return null;
  const t: CourseText = { lang, units: {}, lessons: {}, comingSoon: {} };
  for (const r of rows) {
    const [kind, id] = [r.id.slice(0, r.id.indexOf(":")), r.id.slice(r.id.indexOf(":") + 1)];
    const v = JSON.parse(r.data);
    if (kind === "unit") t.units[id] = v;
    else if (kind === "lesson") t.lessons[id] = v;
    else if (kind === "soon") t.comingSoon![id] = v;
  }
  return t;
}

const pick = <T extends Named>(en: T, t: Named | undefined): T => ({ ...en, title: t?.title || en.title, sub: t?.sub || en.sub });

export const localizeNamed = <T extends Named & { id: string }>(items: T[], t: Record<string, Named> | undefined) => (t ? items.map((i) => pick(i, t[i.id])) : items);

/** One lesson's steps in the translation, line by line, English where a line is missing. */
export function localizeSteps(steps: Step[], text: StepText[] | undefined): Step[] {
  if (!text) return steps;
  return steps.map((s, i) => {
    const t = text[i];
    if (!t) return s;
    const out = { ...s, title: t.title || s.title, body: t.body || s.body } as Step;
    if ("hint" in s && t.hint) (out as { hint: string }).hint = t.hint;
    if (s.kind === "choice" && t.options) (out as typeof s).options = s.options.map((o, j) => ({ ...o, label: t.options![j] || o.label }));
    return out;
  });
}
