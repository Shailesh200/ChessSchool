import type { CoachPersonality } from "@/core/store/settings.store";
import { applyCoachLine } from "./personality";
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
    "What's your opening idea this move?",
    "Think first — develop, claim centre, or castle?",
    "Picture the board two moves ahead before you touch a piece.",
    "Any pawn breaks or piece trades worth calculating?",
    "Where will your king live — kingside or queenside?",
    "Can you improve your worst piece without weakening your king?",
    "What square would you love to put a knight on?",
    "Is there a natural developing move that also makes a threat?",
  ],
  strict: [
    "Calculate. Name your opponent's threat before you move.",
    "Opening — verify the reply to every candidate.",
    "List three legal moves. Eliminate the worst two.",
    "Centre control or development — pick a plan, then a move.",
    "Don't move the same piece twice without a reason.",
    "Check: is any piece undefended after your idea?",
    "Opening discipline — calculate the full line.",
    "What does your opponent want? Block it first.",
  ],
  mentor: [
    "Pause. What does your opponent want on the next move?",
    "Which piece is your worst? How can you improve it?",
    "Sketch a mini-plan for the next three moves.",
    "If you had to describe your position in one word, what is it?",
    "Compare developing vs pushing a pawn here — which is stronger?",
    "Where are the tension points in the centre?",
    "Think about king safety before expanding on the wings.",
    "What would a strong player avoid in this position?",
  ],
  tactical: [
    "Hunt a tactic before you touch a piece.",
    "Scan checks, captures, and threats — in that order.",
    "Any fork, pin, or skewer hiding in the position?",
    "Calculate forcing moves first.",
    "Can you win material with a discovered attack?",
    "Look for loose pieces — are any hanging?",
    "If you had one free move, what would it be?",
    "Sharp eyes — any sacrifice worth calculating?",
  ],
  minimal: ["Calculate.", "Think.", "Plan.", "Line?", "Candidates?", "Reply?"],
};

const MIDDLEGAME: Record<CoachPersonality, string[]> = {
  friendly: [
    "Take a breath — what's the best continuation here?",
    "Calculate a full line before you commit.",
    "What's the dream square for your pieces?",
    "Can you improve coordination between rooks and queen?",
    "Is there a prophylactic move that stops their plan?",
    "Who owns the open file — and should you fight for it?",
    "Picture the pawn structure after your move.",
    "Any piece trapped or boxed in that you can free?",
  ],
  strict: [
    "Calculate two moves deep. Minimum.",
    "List candidate moves, then pick one.",
    "Middlegame — evaluate before you calculate tactics.",
    "Name the worst-placed piece on both sides.",
    "If your move fails, what is the punishment?",
    "Don't rush — compare at least two continuations.",
    "Identify the critical square in this position.",
    "Calculate checks first — always.",
  ],
  mentor: [
    "Middlegame — what's your plan for the next three moves?",
    "Calculate: if I play this, what is the forcing reply?",
    "Which weakness are you targeting — king or pawns?",
    "Can you trade your worst piece for their best?",
    "Where do you want your rooks to sit?",
    "Think about piece activity before material.",
    "What would make your opponent uncomfortable?",
    "Slow down — what's the long-term pawn structure?",
  ],
  tactical: [
    "Look for a combination. Then calculate it to the end.",
    "Checks, captures, threats — in that order.",
    "Any mating net building on the kingside or queenside?",
    "Calculate sacrifices — even wild ones — for 30 seconds.",
    "Is their king exposed enough to attack?",
    "Find the most forcing line available.",
    "Tactics often start with a quiet move — look twice.",
    "Can you deflect a defender?",
  ],
  minimal: ["Calc.", "Line?", "Plan?", "Forcing?", "Checks?", "Best?"],
};

const ENDGAME: Record<CoachPersonality, string[]> = {
  friendly: [
    "Endgame — count the pawns and activate your king in your head first.",
    "Slow down. Precision wins here.",
    "Can your king reach the critical squares?",
    "Calculate pawn races before pushing.",
    "Should you trade pieces or keep tension?",
    "Opposition and zugzwang — worth a look?",
    "Every tempo matters — what's the most precise move?",
    "Picture the final pawn ending before you play.",
  ],
  strict: [
    "Endgame technique. Calculate pawn races and king paths.",
    "No slips — verify zugzwang and opposition.",
    "Count pawn moves, not piece moves.",
    "King first — where does it belong?",
    "Calculate to a known theoretical result.",
    "One imprecision can throw the win — verify.",
    "Should you promote or simplify?",
    "Precision mode — no guesses.",
  ],
  mentor: [
    "Endgame: calculate king entry squares before pushing pawns.",
    "Simplify in your head — then play the best line.",
    "Which pawn is the most dangerous?",
    "Can you create a passed pawn on the right file?",
    "Think triangulation if the kings oppose.",
    "What's the winning idea in one sentence?",
    "Trade when ahead — but only the right pieces.",
    "Calculate the pawn breakthrough first.",
  ],
  tactical: [
    "Endgame tricks exist — calculate checks first.",
    "Sharp eyes — find the resource before you move.",
    "Any stalemate trap to avoid?",
    "Look for knight forks in tight endgames.",
    "Calculate pawn promotion tactics.",
    "Can you win with a skewer on the long diagonal?",
    "Study the king and pawn geometry.",
    "Desperate? Look for perpetual or fortress ideas.",
  ],
  minimal: ["Endgame.", "Precise.", "King.", "Pawns.", "Push?", "Trade?"],
};

const IN_CHECK: Record<CoachPersonality, string[]> = {
  friendly: [
    "You're in check — calculate all legal escapes first!",
    "In check! Find every safe king move.",
    "List blocks, captures, and king walks before choosing.",
    "Can you escape with a counter-threat?",
    "Don't panic — count your legal replies.",
    "In check: sometimes the best escape is a capture.",
    "Calculate each escape to the end of the line.",
    "King safety first — what's the calmest reply?",
  ],
  strict: [
    "In check. Calculate blocks, captures, and king moves.",
    "Answer check before anything else.",
    "Every legal reply — list them, then rank.",
    "In check: verify the escape square is truly safe.",
    "No autopilot — calculate the full answer to check.",
    "Interpose, capture, or king move — evaluate all three.",
    "Check answered badly loses — calculate twice.",
    "Forcing replies only — what stops the attack?",
  ],
  mentor: [
    "In check — list every legal reply, then pick the best square.",
    "Calculate: which escape improves your position?",
    "Can you trade off the attacker?",
    "Sometimes the best answer to check is a counterattack.",
    "Which escape keeps your pieces coordinated?",
    "Don't flee blindly — evaluate each king square.",
    "In check: what does your opponent play next on each escape?",
    "Think prophylaxis after you escape — what's their follow-up?",
  ],
  tactical: [
    "In check! Can you counterattack after you escape?",
    "Calculate forcing replies — checks and captures.",
    "Any discovered check in the escape?",
    "In check — look for a zwischenzug.",
    "Can you win material while escaping?",
    "Calculate sacrifices to defuse the attack.",
    "Escape and threaten mate — is it possible?",
    "Checks, captures, threats — even when you're in check.",
  ],
  minimal: ["In check.", "Escape first.", "Block?", "Capture?", "King?", "Safe?"],
};

const TIER_HINT: Record<ReturnType<typeof tierForElo>, string[]> = {
  novice: [
    "No rush — this is practice.",
    "Take your time — accuracy beats speed.",
    "Breathe. There's no clock in thinking mode.",
  ],
  casual: [
    "Picture the board after your move.",
    "One good look before you commit.",
    "Imagine your opponent's easiest reply.",
  ],
  developing: [
    "Name your opponent's best reply.",
    "Calculate one move deeper than feels comfortable.",
    "Compare two candidates before you choose.",
  ],
  club: [
    "Compare at least two candidates.",
    "Club level — verify tactics before playing.",
    "Don't autopilot — write the line in your head.",
  ],
  expert: [
    "Deep calc — don't play on autopilot.",
    "Expert territory — precision matters.",
    "Calculate the refutation to your first instinct.",
  ],
  master: [
    "One slip loses — verify the line.",
    "Master strength — treat every move as critical.",
    "Calculate the quiet move, not just the obvious one.",
  ],
  elite: [
    "Tournament focus: calculate to a clear evaluation.",
    "Elite duel — see the whole line before moving.",
    "Assume your opponent finds the best defense.",
  ],
};

const CONFIRM: Record<CoachPersonality, string[]> = {
  friendly: [
    "You picked {san} — sure about it?",
    "Ready to play {san}? Double-check first.",
    "{san} looks good — lock it in?",
    "Happy with {san}? Confirm when ready.",
    "Last look at {san} — play it?",
  ],
  strict: [
    "Confirm {san}. Is it best?",
    "Commit to {san}? Verify once more.",
    "{san} — defend your choice.",
    "Final check on {san}.",
    "Play {san}? No takebacks.",
  ],
  mentor: [
    "You calculated {san} — does the line still hold?",
    "Confirm {san} after reviewing the reply.",
    "{san} — walk through the follow-up once more.",
    "Does {san} fit your plan?",
    "Ready to commit to {san}?",
  ],
  tactical: [
    "{san} — if it's forcing, play it. Otherwise rethink.",
    "Lock in {san}? Make sure the tactic works.",
    "{san} — calculate the refutation first.",
    "Tactical shot {san} — confirm the line.",
    "Does {san} win material or mate?",
  ],
  minimal: ["{san}?", "Play {san}?", "Confirm {san}.", "{san} — yes?", "Lock {san}?"],
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
  const pool = inCheck
    ? IN_CHECK[personality]
    : ph === "opening"
      ? OPENING[personality]
      : ph === "endgame"
        ? ENDGAME[personality]
        : MIDDLEGAME[personality];

  if (personality === "minimal") {
    return applyCoachLine(pick(pool, seed), personality, "match");
  }

  const lead = pick(pool, seed);
  const variant = seed % 5;
  if (variant <= 2) {
    return applyCoachLine(lead, personality, "match");
  }
  const tier = tierForElo(botElo);
  const tail = pick(TIER_HINT[tier], seed + 3);
  return applyCoachLine(`${lead} ${tail}`, personality, "match");
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
      `Calculation training at ${elo} — confirm every move before it plays.`,
      `No rush today — picture each line before you commit.`,
    ],
    strict: [
      `Calculation mode vs ${botName}, ${elo}. Confirm every move.`,
      `${botName} · ${elo}. Think first, move second.`,
      `Training duel · ${elo}. Verify each candidate.`,
      `Discipline match — no impulse moves.`,
    ],
    mentor: [
      `Training calc vs ${botName} (${elo}). Picture the line before you play.`,
      `Thinking match with ${botName} — build the habit of seeing replies.`,
      `Slow chess at ${elo} — quality of thought over speed.`,
      `Let's train calculation — confirm moves when you're sure.`,
    ],
    tactical: [
      `Sharp thinking duel vs ${botName} (${elo}) — calculate tactics to the end.`,
      `${botName} at ${elo}. Find the idea, then confirm the move.`,
      `Tactical calc mode — see the whole combination first.`,
      `Hunt forcing lines — then lock in your move.`,
    ],
    minimal: [
      `Think vs ${botName}.`,
      `Calc mode · ${botName}.`,
      `Confirm moves · ${elo}.`,
      `Calculate. Then play.`,
    ],
  };
  return applyCoachLine(pick(intros[personality], seed), personality, "greeting");
}
