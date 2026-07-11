import type { CoachPersonality } from "@/core/store/settings.store";
import { applyCoachLine, personaOf } from "./personality";
import { tierForElo } from "./matchCommentary";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length] ?? list[0] ?? "";
}

function phase(moveNumber: number): "opening" | "middlegame" | "endgame" {
  if (moveNumber < 14) return "opening";
  if (moveNumber > 50) return "endgame";
  return "middlegame";
}

const OPENING: Record<CoachPersonality, string[]> = {
  friendly: [
    "Calculate your opening move — what's the plan?",
    "Think first: develop, centre, or castle soon?",
  ],
  strict: ["Calculate. Name your opponent's threat before you move.", "Opening — verify the reply."],
  mentor: [
    "Pause. What does your opponent want on the next move?",
    "Think: which piece is worst? Can you improve it?",
  ],
  tactical: ["Hunt a tactic before you touch a piece.", "Scan for checks, captures, and threats."],
  minimal: ["Calculate.", "Think."],
};

const MIDDLEGAME: Record<CoachPersonality, string[]> = {
  friendly: [
    "Take a breath — what's the best continuation here?",
    "Calculate a full line before you commit.",
  ],
  strict: ["Calculate two moves deep. Minimum.", "List candidate moves, then pick one."],
  mentor: [
    "Middlegame — what's your plan for the next three moves?",
    "Calculate: if I play this, what is the forcing reply?",
  ],
  tactical: ["Look for a combination. Then calculate it to the end.", "Checks, captures, threats — in that order."],
  minimal: ["Calc.", "Line?"],
};

const ENDGAME: Record<CoachPersonality, string[]> = {
  friendly: ["Endgame — count the pawns and activate your king in your head first.", "Slow down. Precision wins here."],
  strict: ["Endgame technique. Calculate pawn races and king paths.", "No slips — verify zugzwang and opposition."],
  mentor: ["Endgame: calculate king entry squares before pushing pawns.", "Simplify in your head — then play the best line."],
  tactical: ["Endgame tricks exist — calculate checks first.", "Sharp eyes — find the resource before you move."],
  minimal: ["Endgame.", "Precise."],
};

const IN_CHECK: Record<CoachPersonality, string[]> = {
  friendly: ["You're in check — calculate all legal escapes first!", "In check! Find every safe king move."],
  strict: ["In check. Calculate blocks, captures, and king moves.", "Answer check before anything else."],
  mentor: ["In check — list every legal reply, then pick the best square.", "Calculate: which escape improves your position?"],
  tactical: ["In check! Can you counterattack after you escape?", "Calculate forcing replies — checks and captures."],
  minimal: ["In check.", "Escape first."],
};

const TIER_HINT: Record<ReturnType<typeof tierForElo>, string> = {
  novice: " No rush — this is practice.",
  casual: " Picture the board after your move.",
  developing: " Name your opponent's best reply.",
  club: " Compare at least two candidates.",
  expert: " Deep calc — don't play on autopilot.",
  master: " One slip loses — verify the line.",
  elite: " Tournament focus: calculate to a clear evaluation.",
};

const CONFIRM: Record<CoachPersonality, string[]> = {
  friendly: ["You picked {san} — sure about it?", "Ready to play {san}? Double-check first."],
  strict: ["Confirm {san}. Is it best?", "Commit to {san}? Verify once more."],
  mentor: ["You calculated {san} — does the line still hold?", "Confirm {san} after reviewing the reply."],
  tactical: ["{san} — if it's forcing, play it. Otherwise rethink.", "Lock in {san}? Make sure the tactic works."],
  minimal: ["{san}?", "Play {san}?"],
};

/** Coach line when it's the player's turn in a thinking game. */
export function calculationPrompt(
  personality: CoachPersonality,
  botElo: number,
  moveNumber: number,
  inCheck: boolean,
): string {
  const seed = hash(`${personality}:${botElo}:${moveNumber}:${inCheck}`);
  const ph = phase(moveNumber);
  const pool = inCheck ? IN_CHECK[personality] : ph === "opening" ? OPENING[personality] : ph === "endgame" ? ENDGAME[personality] : MIDDLEGAME[personality];
  const nudge = pick(personaOf(personality).nudge, seed + 1);
  const lead = pick(pool, seed);
  const tier = tierForElo(botElo);
  const tail = TIER_HINT[tier];
  const raw = personality === "minimal" ? lead : `${lead} ${nudge}`.trim();
  return applyCoachLine(`${raw}${tail}`, personality, "match");
}

/** Coach line when the player staged a move and must confirm. */
export function confirmMovePrompt(san: string, personality: CoachPersonality): string {
  const seed = hash(`${san}:${personality}`);
  const raw = pick(CONFIRM[personality], seed).replace("{san}", san);
  return applyCoachLine(raw, personality, "match");
}

/** Opening line for a thinking (calculation) game vs a bot. */
export function thinkingMatchGreeting(
  elo: number,
  botName: string,
  personality: CoachPersonality,
): string {
  const seed = hash(`think:${botName}:${elo}:${personality}`);
  const intros: Record<CoachPersonality, string[]> = {
    friendly: [
      `Thinking game vs ${botName} (${elo}) — no clock, just calculation.`,
      `Hi! I'm ${botName}. Take your time and calculate each move.`,
    ],
    strict: [
      `Calculation mode vs ${botName}, ${elo}. Confirm every move.`,
      `${botName} · ${elo}. Think first, move second.`,
    ],
    mentor: [
      `Training calc vs ${botName} (${elo}). Picture the line before you play.`,
      `Thinking match with ${botName} — build the habit of seeing replies.`,
    ],
    tactical: [
      `Sharp thinking duel vs ${botName} (${elo}) — calculate tactics to the end.`,
      `${botName} at ${elo}. Find the idea, then confirm the move.`,
    ],
    minimal: [`Think vs ${botName}.`, `Calc mode · ${botName}.`],
  };
  return applyCoachLine(pick(intros[personality], seed), personality, "greeting");
}
