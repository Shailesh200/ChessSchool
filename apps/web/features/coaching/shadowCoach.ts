import type { CoachPersonality } from "@/core/store/settings.store";
import type { Color } from "@/core/types/chess";
import { applyCoachLine } from "./personality";

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length] ?? list[0] ?? "";
}

const GREETING: Record<CoachPersonality, { sameSeat: string[]; flipped: string[] }> = {
  genz: {
    sameSeat: [
      "Shadow rematch vs {name}. Fresh idea time.",
      "Same opponent, new choices. What changes vs {name}?",
    ],
    flipped: [
      "You're in {name}'s chair. Hold the attack.",
      "Defend the other side. Stop your old line.",
    ],
  },
  sarcastic: {
    sameSeat: [
      "Shadow line vs {name}. Improve on last game.",
      "Replay {name}'s moves. Find a better reply.",
    ],
    flipped: [
      "Opposite seat. Defend your prior aggression.",
      "You played the attack. Prove you can stop it.",
    ],
  },
  anxious_nerd: {
    sameSeat: [
      "Rematch vs {name}. Compare each reply.",
      "Same shadow line. Where could you sharpen?",
    ],
    flipped: [
      "Swap seats. Feel {name}'s problems defending.",
      "Your old moves chase you. Calculate resources.",
    ],
  },
  egoistic: {
    sameSeat: [
      "Shadow hunt vs {name}. Spot where it cracks.",
      "Same book from {name}. Punish lazy replies.",
    ],
    flipped: [
      "Your past attack returns. Block or counter.",
      "Defend vs your own tricks. Calculate forcing lines.",
    ],
  },
  sassy: {
    sameSeat: [
      "Shadow rematch vs {name}. Better move. Impress me.",
      "Replay {name}'s moves. Do something smarter.",
    ],
    flipped: [
      "You're in {name}'s chair. Defend like you mean it.",
      "Other side now. Stop the attack you played.",
    ],
  },
};

const SHADOW_MOVE: Record<CoachPersonality, string[]> = {
  genz: ["{name} plays {san} — just like last time.", "Shadow: {san}. Your turn!"],
  sarcastic: ["{san}. Book move from {name}.", "Shadow {san}. Answer."],
  anxious_nerd: [
    "Recorded {san} from {name}. What's your plan?",
    "{name} replays {san}.",
  ],
  egoistic: ["{san} from the tape. Any shots?", "Shadow {san} — any tactics?"],
  sassy: [
    "{name} plays {san} — déjà vu. Your turn.",
    "Shadow {san}. Don't autopilot the reply.",
  ],
};

const OFF_BOOK: Record<CoachPersonality, string[]> = {
  genz: [
    "You left the book. Shadow can't follow.",
    "New territory! Shadow stops here.",
  ],
  sarcastic: [
    "Off book. Shadow halts — no more tape.",
    "Deviation. You're on your own now.",
  ],
  anxious_nerd: [
    "You branched off the saved game. No more shadow.",
    "Off the replay line. Calculate freely.",
  ],
  egoistic: [
    "Off book — hunt tactics without the crutch.",
    "New line! Shadow can't keep up.",
  ],
  sassy: [
    "Off book — shadow can't follow. You're alone.",
    "New line. Shadow stops here. Finish it.",
  ],
};

const PLAYER_MOVE: Record<CoachPersonality, string[]> = {
  genz: [
    "Nice — steering away from the old game.",
    "Interesting — can shadow keep up?",
  ],
  sarcastic: ["Deviation noted.", "Not the same line as before."],
  anxious_nerd: [
    "A new idea — compare to your previous try.",
    "Different path — evaluate the shadow reply.",
  ],
  egoistic: ["New line — scan for tactics.", "Fresh move — any forcing follow-up?"],
  sassy: [
    "New move — steering away from the old game.",
    "Different path. Shadow might not keep up.",
  ],
};

export function shadowGreeting(
  personality: CoachPersonality,
  opponentName: string,
  playerColor: Color,
  flipped: boolean,
): string {
  const seat = flipped ? "flipped" : "sameSeat";
  const raw = pick(
    GREETING[personality][seat],
    opponentName.length + (flipped ? 7 : 3),
  );
  const colorWord = playerColor === "w" ? "White" : "Black";
  const line = raw.replaceAll("{name}", opponentName).replaceAll("{color}", colorWord);
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
