// Pure progression helpers — mirror web (core/store/progression.store.ts + lib/rank.ts).

export function levelForXp(xp: number): number {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level += 1;
    need = 100 + (level - 1) * 50;
  }
  return level;
}

export function xpProgress(xp: number): { into: number; need: number } {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level += 1;
    need = 100 + (level - 1) * 50;
  }
  return { into: xp - acc, need };
}

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
