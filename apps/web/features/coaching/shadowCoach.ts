import type { CoachPersonality } from "@/core/store/settings.store";
import type { Color } from "@/core/types/chess";
import { applyCoachLine } from "./personality";

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length] ?? list[0] ?? "";
}

const GREETING: Record<
  CoachPersonality,
  { sameSeat: string[]; flipped: string[] }
> = {
  friendly: {
    sameSeat: [
      "Shadow rematch vs {name} — try a fresh idea on the same line.",
      "Same opponent, new choices — what would you play differently vs {name}?",
    ],
    flipped: [
      "You're in {name}'s chair now — can you hold against your old attack?",
      "Defend the other side — stop the line you played last time.",
    ],
  },
  strict: {
    sameSeat: [
      "Shadow line vs {name}. Improve on your previous game.",
      "Replay {name}'s moves. Find a better reply.",
    ],
    flipped: [
      "Opposite seat. Defend vs your prior aggression.",
      "You played the attack last time — prove you can stop it.",
    ],
  },
  mentor: {
    sameSeat: [
      "Rematch vs {name}: compare each reply to what you played before.",
      "Same shadow line — where could your plan have been sharper?",
    ],
    flipped: [
      "Swap seats: feel {name}'s problems from the defending side.",
      "Your old moves will chase you — calculate defensive resources.",
    ],
  },
  tactical: {
    sameSeat: [
      "Shadow hunt vs {name} — spot where the old line cracks.",
      "Same book from {name}. Punish a lazy reply.",
    ],
    flipped: [
      "Your past attack returns — find the block or counter.",
      "Defend vs your own tricks. Calculate forcing lines.",
    ],
  },
  minimal: {
    sameSeat: ["Shadow vs {name}.", "Same line — new move."],
    flipped: ["Defend.", "Other side."],
  },
};

const SHADOW_MOVE: Record<CoachPersonality, string[]> = {
  friendly: ["{name} plays {san} — just like last time.", "Shadow: {san}. Your turn!"],
  strict: ["{san}. Book move from {name}.", "Shadow {san}. Answer."],
  mentor: ["Recorded {san} from {name} — what's your plan against it?", "{name} replays {san}."],
  tactical: ["{san} from the tape. Look for a tactic.", "Shadow {san} — any shots?"],
  minimal: ["{san}.", "Shadow {san}."],
};

const OFF_BOOK: Record<CoachPersonality, string[]> = {
  friendly: [
    "You left the book — shadow can't follow. Keep playing your idea!",
    "New territory! The shadow stops here; finish the game on your own.",
  ],
  strict: [
    "Off book. Shadow halts — no more recorded moves.",
    "Deviation. You're on your own from here.",
  ],
  mentor: [
    "You branched off the saved game — good experiment. No more shadow moves.",
    "Off the replay line. Calculate freely from here.",
  ],
  tactical: [
    "Off book — hunt for tactics without the shadow crutch.",
    "New line! Shadow can't keep up.",
  ],
  minimal: ["Off book.", "Solo from here."],
};

const PLAYER_MOVE: Record<CoachPersonality, string[]> = {
  friendly: ["Nice — you're steering away from the old game.", "Interesting — let's see if shadow can keep up."],
  strict: ["Deviation noted.", "Not the same line as before."],
  mentor: ["A new idea — compare it mentally to your previous try.", "Different path — evaluate the shadow reply."],
  tactical: ["New line — scan for tactics.", "Fresh move — any forcing follow-up?"],
  minimal: ["New.", "Different."],
};

export function shadowGreeting(
  personality: CoachPersonality,
  opponentName: string,
  playerColor: Color,
  flipped: boolean,
): string {
  const seat = flipped ? "flipped" : "sameSeat";
  const raw = pick(GREETING[personality][seat], opponentName.length + (flipped ? 7 : 3));
  const colorWord = playerColor === "w" ? "White" : "Black";
  const line = raw
    .replaceAll("{name}", opponentName)
    .replaceAll("{color}", colorWord);
  return applyCoachLine(line, personality, "greeting");
}

export function shadowMoveLine(
  personality: CoachPersonality,
  san: string,
  opponentName: string,
): string {
  const raw = pick(SHADOW_MOVE[personality], san.charCodeAt(0) + opponentName.length);
  const line = raw.replaceAll("{san}", san).replaceAll("{name}", opponentName);
  return applyCoachLine(line, personality, "match");
}

export function shadowOffBookLine(personality: CoachPersonality): string {
  const raw = pick(OFF_BOOK[personality], 11);
  return applyCoachLine(raw, personality, "match");
}

export function shadowPlayerDeviationLine(personality: CoachPersonality): string {
  const raw = pick(PLAYER_MOVE[personality], 5);
  return applyCoachLine(raw, personality, "match");
}
