/**
 * A score per chess idea (0–100), moved by lessons, practice, puzzle themes and the mistakes
 * found in the learner's own games. It never touches XP; it only steers practice.
 */
export const SKILLS = ["fork", "pin", "skewer", "discovery", "hanging", "mate", "backRank", "endgame"] as const;
export type SkillId = (typeof SKILLS)[number];
export type SkillScore = { s: number; n: number };
export type Skills = Partial<Record<SkillId, SkillScore>>;
export const isSkillId = (v: unknown): v is SkillId => SKILLS.includes(v as SkillId);

const STEP = 0.25;

/** One success or miss on `ids`. The first result starts a skill a little above or below the middle. */
export function skillsAfter(skills: Skills, ids: readonly SkillId[], ok: boolean): Skills {
  if (!ids.length) return skills;
  const next = { ...skills };
  for (const id of new Set(ids)) {
    const cur = next[id];
    const s = !cur ? (ok ? 60 : 40) : ok ? cur.s + (100 - cur.s) * STEP : cur.s - cur.s * STEP;
    next[id] = { s: Math.round(Math.max(0, Math.min(100, s))), n: Math.min(100_000, (cur?.n ?? 0) + 1) };
  }
  return next;
}

/** Skills seen at least once, weakest first. */
export const rankedSkills = (skills: Skills | undefined): { id: SkillId; s: number; n: number }[] =>
  SKILLS.flatMap((id) => (skills?.[id] ? [{ id, ...skills[id]! }] : [])).sort((a, b) => a.s - b.s || b.n - a.n);

/** Up to `max` ideas to practise next: weakest first, and only ones that are not yet strong. */
export const weakSkills = (skills: Skills | undefined, max = 3): SkillId[] =>
  rankedSkills(skills)
    .filter((x) => x.s < 70)
    .slice(0, max)
    .map((x) => x.id);

const THEME_SKILL: Record<string, SkillId> = {
  fork: "fork",
  pin: "pin",
  skewer: "skewer",
  discoveredAttack: "discovery",
  hangingPiece: "hanging",
  mateIn1: "mate",
  mateIn2: "mate",
  backRankMate: "backRank",
  endgame: "endgame",
};
/** Skills a puzzle trains, from its Lichess themes. */
export const themeSkills = (themes: readonly string[]): SkillId[] => [...new Set(themes.flatMap((t) => (THEME_SKILL[t] ? [THEME_SKILL[t]] : [])))];

/** Mistake detector tags (@chessschool/chess `MistakeTag`) to skills. */
const TAG_SKILL: Record<string, SkillId> = { hanging: "hanging", freePiece: "hanging", fork: "fork", pin: "pin", mate: "mate", backRank: "backRank" };
export const tagSkills = (tags: readonly string[]): SkillId[] => [...new Set(tags.flatMap((t) => (TAG_SKILL[t] ? [TAG_SKILL[t]] : [])))];

const LESSON_SKILL: Record<string, SkillId> = {
  forks: "fork",
  pawnFork: "fork",
  knightForkEnding: "fork",
  pins: "pin",
  skewer: "skewer",
  xray: "skewer",
  discovery: "discovery",
  doubleCheck: "discovery",
  windmill: "discovery",
  values: "hanging",
  blunderCheck: "hanging",
  freePawn: "hanging",
  recapture: "hanging",
  countAttackers: "hanging",
  trapBishop: "hanging",
  check: "mate",
  ladder: "mate",
  queenMate: "mate",
  smothered: "mate",
  arabian: "mate",
  rookKing: "mate",
  backRank: "backRank",
  luft: "backRank",
};
const LESSON_PATTERNS: [RegExp, SkillId][] = [
  [/Fork$/, "fork"],
  [/Pin$/, "pin"],
  [/Discovered$/, "discovery"],
  [/Material$|Trapped$/, "hanging"],
  [/Mate$/, "mate"],
  [/Endgame$|Ending$|^(activeKing|opposition|passedPawn|escort|rookFile|squareOfPawn|keySquares|rookPawn|triangulation|lucena|philidor|cutOff|rookVsPawn|activityRook|outsidePasser|protectedPasser|connectedPassers|pawnRace|kingLeads|knightVsPawn|wrongBishop|bishopStopsPawn|oppositeBishops|rookBehind|seventhRank|longSide|rookTrade|rookEscort|queenVsPawn|zugzwang|spareTempo|avoidStalemate)$/, "endgame"],
];
/** The idea a lesson teaches, when it teaches one the skills card tracks. */
export function lessonSkill(lessonId: string): SkillId | null {
  return LESSON_SKILL[lessonId] ?? LESSON_PATTERNS.find(([re]) => re.test(lessonId))?.[1] ?? null;
}

/** Cleans a stored or synced skills record: known ids, scores 0–100, whole counts. */
export function sanitizeSkills(raw: unknown): Skills | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Skills = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const x = v as SkillScore;
    if (!isSkillId(id) || !x || typeof x.s !== "number" || typeof x.n !== "number" || !Number.isFinite(x.s) || !Number.isFinite(x.n)) continue;
    out[id] = { s: Math.round(Math.max(0, Math.min(100, x.s))), n: Math.max(0, Math.min(100_000, Math.floor(x.n))) };
  }
  return Object.keys(out).length ? out : undefined;
}

/** Device and server copies: per skill, the one with more results behind it wins. */
export function mergeSkills(a: Skills | undefined, b: Skills | undefined): Skills | undefined {
  if (!a || !b) return a ?? b;
  const out: Skills = { ...a };
  for (const id of SKILLS) if (b[id] && (!a[id] || b[id]!.n > a[id]!.n)) out[id] = b[id];
  return out;
}
