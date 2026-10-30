import type { CoachCharacterId } from "@/features/coaching/characters";

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

export const MATCH_FEN =
  "r1bqk1nr/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5";

export const MATCH_MOVES = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "Nc3", "Nf6"];
