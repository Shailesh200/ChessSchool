import { Chess, type Square as ChessSquare } from "chess.js";
import type { CoachPersonality } from "@/core/store/settings.store";
import type { Color, Square, VerboseMove } from "@/core/types/chess";
import { ChessEngine } from "@/features/chess-engine/engine";
import { applyCoachLine } from "./personality";
import { tierForElo } from "./matchCommentary";
import { calculationPrompt } from "./thinkingPrompt";

const PIECE: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

type Phase = "opening" | "middlegame" | "endgame";
type Assessment = "great" | "good" | "caution" | "neutral";

type AttackedPiece = { sq: Square; piece: string };

type MoveFacts = {
  move: VerboseMove;
  moverLabel: string;
  phase: Phase;
  moveNumber: number;
  beforeFen: string;
  afterFen: string;
  givesCheck: boolean;
  isMate: boolean;
  wasInCheck: boolean;
  capturedName: string | null;
  isCastle: boolean;
  isFianchetto: boolean;
  developed: boolean;
  centralPawn: boolean;
  flankPawn: boolean;
  pieceAttacked: boolean;
  pieceDefended: boolean;
  assessment: Assessment;
  assessmentWhy: string;
  newAttacks: AttackedPiece[];
  newDefends: AttackedPiece[];
  playerMoveBefore?: VerboseMove;
};

function phase(moveNumber: number, fen: string): Phase {
  if (moveNumber < 14) return "opening";
  const board = fen.split(" ")[0] ?? "";
  const pieces = board.replace(/[^a-zA-Z]/g, "").length;
  if (pieces <= 12) return "endgame";
  return "middlegame";
}

function iterPieces(
  chess: Chess,
  fn: (sq: Square, type: string, color: Color) => void,
) {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r]![f];
      if (!cell) continue;
      const sq = `${FILES[f]}${8 - r}` as Square;
      fn(sq, cell.type, cell.color as Color);
    }
  }
}

function piecesAttackedBy(chess: Chess, attacker: Color): AttackedPiece[] {
  const victimColor: Color = attacker === "w" ? "b" : "w";
  const out: AttackedPiece[] = [];
  iterPieces(chess, (sq, type, color) => {
    if (color !== victimColor) return;
    if (chess.isAttacked(sq as ChessSquare, attacker)) {
      out.push({ sq, piece: PIECE[type] ?? "piece" });
    }
  });
  return out;
}

function attacksAdded(
  beforeFen: string,
  afterFen: string,
  attacker: Color,
): AttackedPiece[] {
  const before = new Chess(beforeFen);
  const after = new Chess(afterFen);
  const prev = new Set(piecesAttackedBy(before, attacker).map((p) => p.sq));
  return piecesAttackedBy(after, attacker).filter((p) => !prev.has(p.sq));
}

function defendsAdded(
  beforeFen: string,
  afterFen: string,
  defender: Color,
): AttackedPiece[] {
  const before = new Chess(beforeFen);
  const after = new Chess(afterFen);
  const prev = new Set(
    iterFriendlyUnderAttack(before, defender)
      .filter((p) => before.isAttacked(p.sq as ChessSquare, defender))
      .map((p) => p.sq),
  );
  return iterFriendlyUnderAttack(after, defender).filter(
    (p) => after.isAttacked(p.sq as ChessSquare, defender) && !prev.has(p.sq),
  );
}

function iterFriendlyUnderAttack(chess: Chess, color: Color): AttackedPiece[] {
  const them: Color = color === "w" ? "b" : "w";
  const out: AttackedPiece[] = [];
  iterPieces(chess, (sq, type, pieceColor) => {
    if (pieceColor !== color) return;
    if (chess.isAttacked(sq as ChessSquare, them))
      out.push({ sq, piece: PIECE[type] ?? "piece" });
  });
  return out;
}

function isFianchetto(move: VerboseMove, color: Color): boolean {
  if (move.piece !== "b") return false;
  const targets = color === "w" ? ["g2", "b2"] : ["g7", "b7"];
  return targets.includes(move.to);
}

function moveHeadline(move: VerboseMove, label: string): string {
  const san = move.san;
  if (san === "O-O") return `${label} castles kingside`;
  if (san === "O-O-O") return `${label} castles queenside`;
  if (move.flags.includes("e")) {
    return `${label} captures en passant on ${move.to}`;
  }
  if (move.promotion) {
    const promo = PIECE[move.promotion] ?? "piece";
    return `${label} promotes the pawn on ${move.to} to a ${promo}`;
  }
  if (move.captured) {
    const taken = PIECE[move.captured] ?? "piece";
    const piece = PIECE[move.piece] ?? "piece";
    return `${label} captures the ${taken} on ${move.to} with the ${piece} from ${move.from}`;
  }
  if (move.piece === "p") {
    return `${label} plays the pawn from ${move.from} to ${move.to}`;
  }
  return `${label} moves the ${PIECE[move.piece]} from ${move.from} to ${move.to}`;
}

function knightSquareNote(sq: Square, forPlayer: boolean): string {
  const notes: Record<string, string> = {
    f3: forPlayer
      ? "The knight on f3 eyes e5 and d4, and it is a natural step toward kingside castling."
      : "Their knight on f3 pressures e5 and d4 — contest those squares if you can.",
    c3: forPlayer
      ? "From c3 the knight can support d5 or reroute toward the kingside."
      : "The knight on c3 may hop to d5 or b5 to harass your position.",
    f6: forPlayer
      ? "The knight on f6 defends the e-pawn and eyes e4 and d5."
      : "The knight on f6 guards e4 and d5 — consider whether those squares matter now.",
    c6: forPlayer
      ? "The knight on c6 develops with pressure on d4 and e5."
      : "Their knight on c6 targets d4 and e5; answer with development or a central pawn.",
  };
  return notes[sq] ?? "";
}

function bishopSquareNote(move: VerboseMove, color: Color, forPlayer: boolean): string {
  if (isFianchetto(move, color)) {
    const side = move.to[0] === "g" ? "kingside" : "queenside";
    return forPlayer
      ? `That fianchetto places your bishop on the long ${side} diagonal, aiming through the centre — useful if you later push ...e5 or ...d6.`
      : `That fianchetto posts the bishop on the long ${side} diagonal toward your centre; if you castle that way, the diagonal can point at your king.`;
  }
  const notes: Record<string, string> = {
    c4: forPlayer
      ? "The bishop on c4 eyes f7 and pressures the centre — a classic developing square."
      : "The bishop on c4 eyes your f7 pawn and the centre; shore up f7 if you have not castled.",
    f4: forPlayer
      ? "The bishop on f4 is active, but make sure the e-pawn is not left weak."
      : "An active bishop on f4 can target your kingside — check whether g7 or e7 is soft.",
    g5: forPlayer
      ? "The bishop on g5 pins or pressures the knight on f6 if it is there."
      : "The bishop on g5 can pin your knight on f6 — consider whether h6 or ...Be7 is needed.",
  };
  return notes[move.to] ?? "";
}

function formatAttackList(items: AttackedPiece[], max = 3): string {
  const slice = items.slice(0, max);
  const text = slice.map((p) => `your ${p.piece} on ${p.sq}`).join(", ");
  return items.length > max ? `${text}, and more` : text;
}

function formatDefendList(items: AttackedPiece[], max = 2): string {
  return items
    .slice(0, max)
    .map((p) => `your ${p.piece} on ${p.sq}`)
    .join(" and ");
}

function gatherFacts(
  beforeFen: string,
  move: VerboseMove,
  afterFen: string,
  moverLabel: string,
  moveNumber: number,
  playerMoveBefore?: VerboseMove,
): MoveFacts {
  const before = new ChessEngine(beforeFen);
  const after = new Chess(beforeFen);
  after.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion as "q" | "r" | "b" | "n" | undefined,
  });

  const us = move.color;
  const them: Color = us === "w" ? "b" : "w";
  const ph = phase(moveNumber, beforeFen);
  const backRank = us === "w" ? "1" : "8";
  const center = new Set(["e4", "d4", "e5", "d5", "c4", "c5", "f4", "f5"]);

  const developed =
    ph === "opening" &&
    (move.piece === "n" || move.piece === "b") &&
    move.from[1] === backRank;

  const centralPawn = move.piece === "p" && center.has(move.to) && ph === "opening";
  const flankPawn =
    ph === "opening" &&
    move.piece === "p" &&
    !move.captured &&
    (move.from[0] === "a" || move.from[0] === "h") &&
    move.from[0] === move.to[0];
  const fianchetto = isFianchetto(move, us);

  const pieceAttacked = after.isAttacked(move.to as ChessSquare, them);
  const pieceDefended = after.isAttacked(move.to as ChessSquare, us);
  const newAttacks = attacksAdded(beforeFen, afterFen, us);
  const newDefends = defendsAdded(beforeFen, afterFen, us);

  let assessment: Assessment = "neutral";
  let assessmentWhy = "";

  if (move.san.includes("#")) {
    assessment = "great";
    assessmentWhy = "Checkmate — the king has no legal escape.";
  } else if (move.captured === "q" || (move.captured === "r" && move.piece !== "p")) {
    assessment = "great";
    assessmentWhy = `Winning the ${PIECE[move.captured!]} is a big material gain.`;
  } else if (move.san.includes("+")) {
    assessment = "good";
    assessmentWhy = "Check forces an immediate reply and can gain time.";
  } else if (move.flags.includes("k") || move.flags.includes("q")) {
    assessment = "good";
    assessmentWhy = "Castling tucks the king away and activates the rook.";
  } else if (fianchetto && ph === "opening") {
    assessment = "good";
    assessmentWhy = "Fianchettoing develops the bishop on a strong diagonal.";
  } else if (developed && move.piece === "n") {
    assessment = "good";
    assessmentWhy = `Developing the knight to ${move.to} follows opening principles.`;
  } else if (developed && move.piece === "b" && !fianchetto) {
    assessment = "good";
    assessmentWhy = `The bishop on ${move.to} joins the fight and influences the centre.`;
  } else if (centralPawn) {
    assessment = "good";
    assessmentWhy = `The pawn on ${move.to} claims central space.`;
  } else if (pieceAttacked && !pieceDefended && VALUE[move.piece]! >= 3) {
    assessment = "caution";
    assessmentWhy = `The ${PIECE[move.piece]} on ${move.to} is attacked and undefended — it may be lost.`;
  } else if (pieceAttacked && pieceDefended) {
    assessment = "caution";
    assessmentWhy = `The ${PIECE[move.piece]} on ${move.to} is attacked; calculate whether the trade is safe.`;
  } else if (before.inCheck() && !after.isCheck()) {
    assessment = "good";
    assessmentWhy = "You got out of check without losing material.";
  } else if (
    move.piece === "p" &&
    ph === "opening" &&
    (move.to[0] === "f" || move.to[0] === "g") &&
    us === "w"
  ) {
    assessment = "caution";
    assessmentWhy =
      "Moving the kingside pawns early can weaken the king — castle soon or justify the push.";
  }

  return {
    move,
    moverLabel,
    phase: ph,
    moveNumber,
    beforeFen,
    afterFen,
    givesCheck: after.isCheck(),
    isMate: after.isCheckmate(),
    wasInCheck: before.inCheck(),
    capturedName: move.captured ? (PIECE[move.captured] ?? null) : null,
    isCastle: move.flags.includes("k") || move.flags.includes("q"),
    isFianchetto: fianchetto,
    developed,
    centralPawn,
    flankPawn,
    pieceAttacked,
    pieceDefended,
    assessment,
    assessmentWhy,
    newAttacks,
    newDefends,
    playerMoveBefore,
  };
}

function assessmentPrefix(assessment: Assessment): string {
  if (assessment === "great") return "Strong move:";
  if (assessment === "good") return "Good:";
  if (assessment === "caution") return "Watch out:";
  return "";
}

function specificLines(facts: MoveFacts, forPlayer: boolean): string[] {
  const lines: string[] = [];
  const m = facts.move;
  const you = forPlayer;

  if (facts.isFianchetto) {
    lines.push(bishopSquareNote(m, m.color, you));
  } else if (m.piece === "b") {
    const note = bishopSquareNote(m, m.color, you);
    if (note) lines.push(note);
  }

  if (m.piece === "n" && facts.developed) {
    const note = knightSquareNote(m.to as Square, you);
    if (note) lines.push(note);
  }

  if (facts.centralPawn) {
    lines.push(
      you
        ? `The pawn on ${m.to} fights for the centre and opens lines for your bishops.`
        : `The pawn on ${m.to} grabs central space and may cramp your pieces.`,
    );
  }

  if (facts.flankPawn) {
    const side = m.from[0] === "a" ? "queenside" : "kingside";
    lines.push(
      you
        ? `You stake space on the ${side}; a later pawn break there can open a file for your rook.`
        : `They push on the ${side} instead of meeting you in the centre — finish development before chasing the flank.`,
    );
  }

  if (facts.newAttacks.length === 1) {
    const t = facts.newAttacks[0]!;
    lines.push(
      you
        ? `You now attack their ${t.piece} on ${t.sq}.`
        : `That newly attacks ${formatAttackList(facts.newAttacks)}.`,
    );
  } else if (facts.newAttacks.length > 1) {
    lines.push(
      you
        ? `You now threaten ${formatAttackList(facts.newAttacks).replace(/your /g, "their ")}.`
        : `That newly threatens ${formatAttackList(facts.newAttacks)}.`,
    );
  }

  if (facts.newDefends.length > 0 && facts.newAttacks.length === 0) {
    lines.push(
      you
        ? `You also defend ${formatDefendList(facts.newDefends)}.`
        : `It also protects ${formatDefendList(facts.newDefends).replace(/your /g, "their ")}.`,
    );
  }

  if (facts.givesCheck && !facts.isMate) {
    lines.push(
      you
        ? "Your opponent must deal with the check before doing anything else."
        : "You are in check — block, capture, or move the king before anything else.",
    );
  }

  if (!forPlayer && facts.playerMoveBefore && facts.phase === "opening") {
    const pm = facts.playerMoveBefore;
    if (pm.piece === "p" && (pm.to === "e4" || pm.to === "d4") && facts.isFianchetto) {
      lines.push(
        `This fianchetto is a common answer to your ${pm.to} centre pawn — they aim at the centre from the flank.`,
      );
    }
  }

  if (
    !forPlayer &&
    facts.pieceAttacked &&
    !facts.pieceDefended &&
    VALUE[m.piece]! >= 3
  ) {
    lines.push(
      `You can take the ${PIECE[m.piece]} on ${m.to} if the tactics work — it is undefended.`,
    );
  }

  return lines.filter(Boolean);
}

function nextStep(facts: MoveFacts, forPlayer: boolean): string {
  if (facts.isMate) {
    return forPlayer
      ? "The game is yours."
      : "Review how the attack built up move by move.";
  }
  if (facts.givesCheck && forPlayer) {
    return "Look at every legal reply they have before you continue.";
  }
  if (facts.assessment === "caution" && forPlayer) {
    return "Before you move again, see if they can win material on the next turn.";
  }
  if (facts.phase === "opening" && forPlayer && facts.moveNumber < 12) {
    if (facts.move.piece === "p" && facts.centralPawn) {
      return "Next: develop knights and bishops toward the centre, then castle.";
    }
    return "";
  }
  if (!forPlayer && facts.givesCheck) {
    return "Solve the check first, then look for a counter-threat.";
  }
  return "";
}

function composeLesson(
  facts: MoveFacts,
  forPlayer: boolean,
  personality: CoachPersonality,
  tier: ReturnType<typeof tierForElo>,
): string {
  const label = forPlayer ? "You" : facts.moverLabel;
  const lines: string[] = [moveHeadline(facts.move, label) + "."];

  for (const line of specificLines(facts, forPlayer)) {
    if (line) lines.push(line);
  }

  if (facts.assessmentWhy) {
    const prefix = assessmentPrefix(facts.assessment);
    lines.push(prefix ? `${prefix} ${facts.assessmentWhy}` : facts.assessmentWhy);
  }

  const step = nextStep(facts, forPlayer);
  if (step && (personality !== "minimal" || tier === "novice" || tier === "casual")) {
    lines.push(step);
  }

  return dedupeSentences(lines.join(" "));
}

function dedupeSentences(text: string): string {
  const banned = /\b(reply|find your next idea|picture the reply)\b/gi;
  let out = text
    .replace(banned, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  out = out.replace(/\s*\([NBRQK]?[a-h]?[x]?[a-h][1-8](=[NBRQ])?[+#]?\)\s*/gi, " ");
  const parts = out.split(/(?<=[.!?])\s+/).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique.join(" ");
}

export function explainAssistedPlayerMove(input: {
  beforeFen: string;
  move: VerboseMove;
  afterFen: string;
  inCheckAfter: boolean;
  moveNumber: number;
  playerRating: number;
  botName: string;
  personality: CoachPersonality;
}): string {
  const tier = tierForElo(input.playerRating);
  const facts = gatherFacts(
    input.beforeFen,
    input.move,
    input.afterFen,
    "You",
    input.moveNumber,
  );
  if (input.inCheckAfter && !facts.givesCheck) facts.givesCheck = true;
  const line = composeLesson(facts, true, input.personality, tier);
  return applyCoachLine(line, input.personality, "match");
}

export function explainAssistedBotReply(input: {
  beforeFen: string;
  move: VerboseMove;
  afterFen: string;
  botName: string;
  playerRating: number;
  personality: CoachPersonality;
  moveNumber: number;
  playerMoveBefore?: VerboseMove;
  playerBeforeFen?: string;
}): string {
  const tier = tierForElo(input.playerRating);
  const facts = gatherFacts(
    input.beforeFen,
    input.move,
    input.afterFen,
    input.botName,
    input.moveNumber,
    input.playerMoveBefore,
  );
  const line = composeLesson(facts, false, input.personality, tier);
  return applyCoachLine(line, input.personality, "match");
}

export function assistedPuzzlePrompt(
  personality: CoachPersonality,
  playerRating: number,
  moveNumber: number,
  inCheck: boolean,
): string {
  return calculationPrompt(personality, playerRating, moveNumber, inCheck);
}

export function explainAssistedPuzzleMove(input: {
  san: string;
  correct: boolean;
  successText: string;
  failText: string;
  personality: CoachPersonality;
  playerRating: number;
}): string {
  const base = input.correct ? input.successText : input.failText;
  const extra = input.correct
    ? "Walk through the follow-up moves in your head to confirm the line."
    : "Look for checks, captures, and threats you may have missed.";
  return applyCoachLine(
    dedupeSentences(`${base} ${extra}`),
    input.personality,
    input.correct ? "success" : "wrong",
  );
}
