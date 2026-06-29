/** Academic rank — rises as the student graduates more classes. */
const RANKS: { min: number; title: string }[] = [
  { min: 0, title: "Novice" },
  { min: 1, title: "Pupil" },
  { min: 3, title: "Apprentice" },
  { min: 6, title: "Scholar" },
  { min: 11, title: "Adept" },
  { min: 21, title: "Expert" },
  { min: 41, title: "Candidate Master" },
  { min: 71, title: "Master" },
];

export function rankForClasses(graduatedCount: number): string {
  let title = RANKS[0]!.title;
  for (const r of RANKS) if (graduatedCount >= r.min) title = r.title;
  return title;
}

/** Classes still needed to reach the next rank (0 if at the top). */
export function classesToNextRank(graduatedCount: number): number {
  const next = RANKS.find((r) => r.min > graduatedCount);
  return next ? next.min - graduatedCount : 0;
}
