import type { Step } from "@chessschool/chess";

/** A practice item: one playable step, addressed as "<lessonId>:<stepIndex>" so the app can schedule reviews. */
export type PracticeItem = { ref: string; step: Step };

export const MAX_PRACTICE = 10;
const playable = (s: Step) => s.kind === "tap" || s.kind === "move" || s.kind === "stars" || s.kind === "choice" || s.kind === "line";

/** Due reviews first (in the order given), then random playable steps from the lessons, no repeats. */
export function pickPractice(lessons: { id: string; steps: Step[] }[], review: string[], count: number, rand: () => number = Math.random): PracticeItem[] {
  const all = new Map<string, Step>();
  for (const l of lessons) l.steps.forEach((step, i) => playable(step) && all.set(`${l.id}:${i}`, step));
  const out: PracticeItem[] = [];
  for (const ref of review) {
    const step = all.get(ref);
    if (step && out.length < count && !out.some((o) => o.ref === ref)) out.push({ ref, step });
  }
  const rest = [...all.keys()].filter((ref) => !out.some((o) => o.ref === ref));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  for (const ref of rest.slice(0, count - out.length)) out.push({ ref, step: all.get(ref)! });
  return out;
}
