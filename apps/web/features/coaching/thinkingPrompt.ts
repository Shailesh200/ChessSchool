import type { CoachPersonality } from "@/core/store/settings.store";
import { applyCoachLine } from "./personality";
import { buildThinkingGreeting } from "./botVoice";
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
  genz: [
    "Develop, centre, or castle — what's the vibe?",
    "Think first. Pieces before ego.",
    "Picture two moves ahead before touching.",
    "Any pawn breaks worth the hype?",
    "Where's the king landing?",
    "Worst piece on the board — fix it?",
    "Dream knight square — can you reach it?",
    "Developing move that also threatens?",
  ],
  sarcastic: [
    "Calculate. Name their threat before you move.",
    "Opening — verify the reply to every candidate.",
    "List three moves. Eliminate the worst two.",
    "Centre or development — pick a plan.",
    "Don't move the same piece twice for fun.",
    "Any piece undefended after your idea?",
    "Opening discipline — calculate the full line.",
    "What does your opponent want? Block it.",
  ],
  anxious_nerd: [
    "Pause with me. What do they want next?",
    "Worst piece — improve it without panicking.",
    "Sketch three moves ahead. I'll wait.",
    "Develop or push a pawn? Compare both.",
    "Where's the tension in the centre?",
    "King safety before wing expansion.",
    "What would a strong player avoid here?",
    "One word for this position — then move.",
  ],
  egoistic: [
    "Hunt a tactic before you touch a piece.",
    "Scan checks, captures, threats — that order.",
    "Any fork, pin, or skewer hiding here?",
    "Calculate forcing moves first.",
    "Win material with a discovered attack?",
    "Loose pieces — any hanging?",
    "One free move — what would it be?",
    "Sharp eyes — any sacrifice worth calc?",
  ],
  sassy: [
    "Calculate. Don't embarrass us.",
    "Think before you touch. Revolutionary.",
    "Plan first. Hope isn't strategy.",
    "Full line in your head — then move.",
    "Rank your candidates. Pick the best.",
    "Know their reply before you play.",
  ],
};

const MIDDLEGAME: Record<CoachPersonality, string[]> = {
  genz: [
    "What's the best continuation here?",
    "Calculate a full line before committing.",
    "Dream square for your pieces?",
    "Improve rook and queen coordination?",
    "Prophylactic move that stops their plan?",
    "Who owns the open file?",
    "Pawn structure after your move?",
    "Any piece trapped that you can free?",
  ],
  sarcastic: [
    "Calculate two moves deep. Minimum.",
    "List candidates, then pick one.",
    "Evaluate before you calculate tactics.",
    "Worst piece on both sides — name it.",
    "If your move fails, what's the punishment?",
    "Compare at least two continuations.",
    "Critical square in this position?",
    "Calculate checks first — always.",
  ],
  anxious_nerd: [
    "Plan for the next three moves?",
    "If I play this, what's the forcing reply?",
    "Which weakness — king or pawns?",
    "Trade your worst for their best?",
    "Where do rooks want to sit?",
    "Piece activity before material.",
    "What makes your opponent uncomfortable?",
    "Slow down — long-term pawn structure?",
  ],
  egoistic: [
    "Look for a combination. Calc to the end.",
    "Checks, captures, threats — that order.",
    "Mating net on kingside or queenside?",
    "Calculate wild sacrifices for thirty seconds.",
    "Is their king exposed enough to attack?",
    "Most forcing line available?",
    "Tactics start with quiet moves — look twice.",
    "Can you deflect a defender?",
  ],
  sassy: [
    "Calc two deep. Minimum. Don't be lazy.",
    "Candidates — pick one that works.",
    "Evaluate before you fantasize about tactics.",
    "Worst piece on both sides. Fix yours.",
    "If your move fails, what's the punishment?",
    "Compare two lines. Pick the sharper one.",
    "Critical square — find it.",
    "Checks first. Always checks first.",
  ],
};

const ENDGAME: Record<CoachPersonality, string[]> = {
  genz: [
    "Count pawns. Activate your king first.",
    "Slow down. Precision wins here.",
    "Can your king reach critical squares?",
    "Calculate pawn races before pushing.",
    "Trade pieces or keep tension?",
    "Opposition and zugzwang — worth a look?",
    "Every tempo matters — most precise move?",
    "Picture the pawn ending before playing.",
  ],
  sarcastic: [
    "Endgame technique. Pawn races and king paths.",
    "No slips — verify zugzwang and opposition.",
    "Count pawn moves, not piece moves.",
    "King first — where does it belong?",
    "Calculate to a known result.",
    "One imprecision throws the win — verify.",
    "Promote or simplify?",
    "Precision mode — no guesses.",
  ],
  anxious_nerd: [
    "Calculate king entry before pushing pawns.",
    "Simplify in your head — then play best.",
    "Which pawn is most dangerous?",
    "Create a passed pawn on the right file?",
    "Triangulation if kings oppose?",
    "Winning idea in one sentence?",
    "Trade when ahead — right pieces only.",
    "Calculate the pawn breakthrough first.",
  ],
  egoistic: [
    "Endgame tricks — calculate checks first.",
    "Sharp eyes — find the resource first.",
    "Any stalemate trap to avoid?",
    "Knight forks in tight endgames?",
    "Calculate pawn promotion tactics.",
    "Skewer on the long diagonal?",
    "King and pawn geometry — study it.",
    "Desperate? Perpetual or fortress ideas.",
  ],
  sassy: [
    "Endgame — count pawns, activate king.",
    "Slow down. Sloppy loses here.",
    "Can your king reach key squares?",
    "Pawn race? Calculate before pushing.",
    "Trade or tension — pick with a brain.",
    "Opposition — worth a look, genius.",
    "Every tempo counts. Don't waste one.",
    "Picture the pawn ending before playing.",
  ],
};

const IN_CHECK: Record<CoachPersonality, string[]> = {
  genz: [
    "In check — calculate all legal escapes first!",
    "In check! Find every safe king move.",
    "Blocks, captures, king walks — list them.",
    "Escape with a counter-threat?",
    "Don't panic — count legal replies.",
    "Best escape might be a capture.",
    "Calculate each escape to the end.",
    "King safety first — calmest reply?",
  ],
  sarcastic: [
    "In check. Blocks, captures, king moves.",
    "Answer check before anything else.",
    "Every legal reply — list and rank.",
    "Verify the escape square is truly safe.",
    "No autopilot — calculate the full answer.",
    "Interpose, capture, or king move — all three.",
    "Check answered badly loses — calc twice.",
    "Forcing replies only — stop the attack.",
  ],
  anxious_nerd: [
    "In check — list every legal reply first.",
    "Which escape improves your position?",
    "Can you trade off the attacker?",
    "Best answer to check is counterattack sometimes.",
    "Which escape keeps pieces coordinated?",
    "Don't flee blindly — evaluate each square.",
    "What do they play next on each escape?",
    "Prophylaxis after escape — their follow-up?",
  ],
  egoistic: [
    "In check! Counterattack after you escape?",
    "Calculate forcing replies — checks and captures.",
    "Any discovered check in the escape?",
    "In check — look for a zwischenzug.",
    "Win material while escaping?",
    "Calculate sacrifices to defuse the attack.",
    "Escape and threaten mate — possible?",
    "Checks, captures, threats — even in check.",
  ],
  sassy: [
    "In check — list every legal escape first.",
    "Check! Safe king square. No panic.",
    "Blocks, captures, king walks — rank them.",
    "Counter-threat on the escape? Look for it.",
    "Don't flail — count legal replies.",
    "Best escape might be a capture.",
    "Calculate each escape to the end.",
    "Calm square. You're fine. Probably.",
  ],
};

const TIER_HINT: Record<ReturnType<typeof tierForElo>, string[]> = {
  novice: [
    "No rush — this is practice.",
    "Take your time — accuracy beats speed.",
    "Breathe. No clock in thinking mode.",
  ],
  casual: [
    "Picture the board after your move.",
    "One good look before you commit.",
    "Imagine their easiest reply.",
  ],
  developing: [
    "Name their best reply.",
    "Calculate one move deeper than comfortable.",
    "Compare two candidates before choosing.",
  ],
  club: [
    "Compare at least two candidates.",
    "Club level — verify tactics before playing.",
    "Don't autopilot — write the line.",
  ],
  expert: [
    "Deep calc — don't play on autopilot.",
    "Expert territory — precision matters.",
    "Calculate the refutation to your instinct.",
  ],
  master: [
    "One slip loses — verify the line.",
    "Master strength — every move is critical.",
    "Calculate the quiet move, not the obvious.",
  ],
  elite: [
    "Tournament focus — calc to clear evaluation.",
    "Elite duel — see the whole line first.",
    "Assume they find the best defense.",
  ],
};

const CONFIRM: Record<CoachPersonality, string[]> = {
  genz: [
    "You picked {san} — sure about it?",
    "Ready to play {san}? Double-check first.",
    "{san} looks good — lock it in?",
    "Happy with {san}? Confirm when ready.",
    "Last look at {san} — play it?",
  ],
  sarcastic: [
    "Confirm {san}. Is it best?",
    "Commit to {san}? Verify once more.",
    "{san} — defend your choice.",
    "Final check on {san}.",
    "Play {san}? No takebacks.",
  ],
  anxious_nerd: [
    "You calculated {san} — line still hold?",
    "Confirm {san} after reviewing the reply.",
    "{san} — walk through the follow-up once.",
    "Does {san} fit your plan?",
    "Ready to commit to {san}?",
  ],
  egoistic: [
    "{san} — if forcing, play it. Otherwise rethink.",
    "Lock in {san}? Make sure the tactic works.",
    "{san} — calculate the refutation first.",
    "Tactical shot {san} — confirm the line.",
    "Does {san} win material or mate?",
  ],
  sassy: [
    "{san}? Sure about that?",
    "Play {san}? Don't bore me with a blunder.",
    "{san} — lock it in or rethink.",
    "Happy with {san}? Confirm if confident.",
    "Last look at {san}. Then commit.",
  ],
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

  if (personality === "sassy") {
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
  return applyCoachLine(
    buildThinkingGreeting(elo, botName, personality),
    personality,
    "greeting",
  );
}
