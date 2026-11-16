import { copy } from "./copy";

/** What the key-moment card needs to know about the decisive move (from @chessschool/chess review + detector). */
export type KeyMomentFacts = { kind: "mistake" | "great"; verdict: "good" | "inaccuracy" | "mistake" | "blunder"; better: string | null; tags: readonly string[] };

/** The card's one line: the coach's saved note when there is one, else the detector tag, else the review's own words. No AI call. */
export function keyMomentText(m: KeyMomentFacts, coachNote?: string | null): string {
  if (coachNote?.trim()) return coachNote.trim();
  if (m.kind === "great") return copy.keyMoment.greatBody;
  const tag = m.tags.map((t) => copy.keyMoment.tags[t]).find(Boolean);
  if (tag) return tag;
  return m.verdict === "good" ? copy.analysis.explain.good : copy.analysis.explain[m.verdict](m.better);
}
