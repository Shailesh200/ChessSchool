import type { LessonRecord } from "@/core/store/progression.store";
import type { CoachCharacterId } from "@/features/coaching/characters";

export type ReviewSkill = {
  id: string;
  title: string;
  icon: string;
  lessonId: string;
  fixture: number;
};

/** Design 20 / 10a skills, wired to real curriculum lesson ids. */
export const REVIEW_CATALOG: ReviewSkill[] = [
  {
    id: "fork",
    title: "Fork the king and queen",
    icon: "target",
    lessonId: "fork-master",
    fixture: 48,
  },
  {
    id: "pin",
    title: "Pins to the king",
    icon: "lock",
    lessonId: "pin-it",
    fixture: 55,
  },
  {
    id: "knight",
    title: "Knight moves",
    icon: "puzzle",
    lessonId: "knight-hops",
    fixture: 90,
  },
  {
    id: "mate",
    title: "Back-rank mate",
    icon: "trophy",
    lessonId: "mate-in-one",
    fixture: 72,
  },
  {
    id: "protect",
    title: "Protect your pieces",
    icon: "shield-check",
    lessonId: "pre-pieces-king",
    fixture: 81,
  },
  {
    id: "castle",
    title: "Castling",
    icon: "crown",
    lessonId: "pre-moves-castling",
    fixture: 64,
  },
];

export const PRACTICE_LINE = 60;

export function skillPercent(
  record: LessonRecord | undefined,
  fixture: boolean,
  fixturePct: number,
): number {
  if (fixture) return fixturePct;
  if (!record) return 0;
  return Math.round(Math.max(0, Math.min(1, record.mastery)) * 100);
}

export function reviewDueCount(
  lessons: Record<string, LessonRecord>,
  now = Date.now(),
): number {
  return REVIEW_CATALOG.filter((skill) => {
    const record = lessons[skill.lessonId];
    if (!record) return true;
    return record.mastery < 1 && record.dueAt <= now;
  }).length;
}

export type OpponentId = "skye" | "kira" | "rex" | "ash";

export type Opponent = {
  id: OpponentId;
  name: string;
  character: CoachCharacterId;
  level: "Easy" | "Medium" | "Hard";
  elo: number;
  blurb: string;
  line: string;
  optional?: boolean;
  portrait: string;
  glow1: string;
  glow2: string;
};

export const OPPONENTS: Opponent[] = [
  {
    id: "skye",
    name: "Skye",
    character: "sassy",
    level: "Easy",
    elo: 600,
    blurb: "Playful and dramatic. Plays like art.",
    line: "Hmm, which piece wants the spotlight?",
    portrait: "/coaches/skye-premium.webp",
    glow1: "#ECE2FB",
    glow2: "#C3AEEB",
  },
  {
    id: "kira",
    name: "Kira",
    character: "genz",
    level: "Medium",
    elo: 1100,
    blurb: "Sporty and fast. Treats it like training.",
    line: "Yesss, clean move!",
    portrait: "/coaches/kira-premium.webp",
    glow1: "#D3F1EA",
    glow2: "#86D3C5",
  },
  {
    id: "rex",
    name: "Rex",
    character: "egoistic",
    level: "Hard",
    elo: 1800,
    blurb: "A proud grandmaster. Plays by the book.",
    line: "Observe, and learn from the best.",
    portrait: "/coaches/rex-premium.webp",
    glow1: "#F8E6E6",
    glow2: "#E3A8A8",
  },
  {
    id: "ash",
    name: "Ash",
    character: "sarcastic",
    level: "Hard",
    elo: 2000,
    blurb: "Off by default. Ash is strict and has no hints.",
    line: "Impress me.",
    optional: true,
    portrait: "/coaches/ash-premium.webp",
    glow1: "#EBEFF0",
    glow2: "#AEBCC0",
  },
];

export function opponentById(id: string | undefined): Opponent {
  return OPPONENTS.find((o) => o.id === id) ?? OPPONENTS[1]!;
}

export type GymPuzzle = {
  id: string;
  title: string;
  skill: "Forks" | "Pins" | "Skewers" | "Mates" | "Endgames";
  level: "Easy" | "Medium" | "Hard";
  lessonId: string;
  fen: string;
  /** Design fixture solved flag. Live status comes from lesson mastery. */
  fixtureDone: boolean;
};

export const GYM_PUZZLES: GymPuzzle[] = [
  {
    id: "fork-kq",
    title: "Fork the king and queen",
    skill: "Forks",
    level: "Easy",
    lessonId: "fork-master",
    fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
    fixtureDone: true,
  },
  {
    id: "pin-knight",
    title: "Pin the knight",
    skill: "Pins",
    level: "Easy",
    lessonId: "pin-it",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3",
    fixtureDone: false,
  },
  {
    id: "skewer-rook",
    title: "Skewer the rook",
    skill: "Skewers",
    level: "Medium",
    lessonId: "skewer-it",
    fen: "q7/8/8/k7/8/8/8/1R4K1 w - - 0 1",
    fixtureDone: true,
  },
  {
    id: "back-rank",
    title: "Back-rank mate in one",
    skill: "Mates",
    level: "Easy",
    lessonId: "mate-in-one",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    fixtureDone: false,
  },
  {
    id: "knight-c7",
    title: "Knight fork on c7",
    skill: "Forks",
    level: "Medium",
    lessonId: "knight-hops",
    fen: "k7/8/4p3/8/3N4/8/8/7K w - - 0 1",
    fixtureDone: false,
  },
  {
    id: "opposition",
    title: "Opposition",
    skill: "Endgames",
    level: "Hard",
    lessonId: "endgame-opposition",
    fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
    fixtureDone: false,
  },
  {
    id: "win-queen",
    title: "Win the queen with a skewer",
    skill: "Skewers",
    level: "Hard",
    lessonId: "skewer-it",
    fen: "3q2k1/8/8/8/8/8/1B6/4K3 w - - 0 1",
    fixtureDone: false,
  },
  {
    id: "smothered",
    title: "Smothered mate",
    skill: "Mates",
    level: "Hard",
    lessonId: "endgame-qmate",
    fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1",
    fixtureDone: false,
  },
];

export const DAILY_PUZZLE = GYM_PUZZLES[0]!;

export const MATCH_FEN =
  "r1bqk1nr/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5";

export const MATCH_MOVES = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "Nc3", "Nf6"];

/** Position from design 10b (knight on a7, black queen on a2). */
export const FIX_FEN = "4k3/Np3pp1/8/8/8/8/q4pp1/6K1 w - - 0 1";
