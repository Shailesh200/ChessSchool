import { ChessEngine } from "@/features/chess-engine/engine";
import type { CoachPersonality } from "@/core/store/settings.store";
import type { VerboseMove } from "@/core/types/chess";
import { applyCoachLine } from "./personality";
import {
  buildMatchGreeting,
  buildMoveComment,
  passPlayGreeting as botPassPlayGreeting,
  type MoveCommentKind,
} from "./botVoice";

export type BotTier =
  "novice" | "casual" | "developing" | "club" | "expert" | "master" | "elite";

export interface MatchMoveContext {
  beforeFen: string;
  move: VerboseMove;
  botElo: number;
  botName: string;
  personality: CoachPersonality;
  /** Human just moved — bot is reacting. */
  reactingToPlayer: boolean;
  moveNumber: number;
}

type MoveKind =
  | "mate"
  | "check"
  | "capture_queen"
  | "capture_rook"
  | "capture_minor"
  | "capture_pawn"
  | "castle"
  | "promote"
  | "en_passant"
  | "develop"
  | "center"
  | "escape_check"
  | "quiet";

export function tierForElo(elo: number): BotTier {
  if (elo <= 500) return "novice";
  if (elo <= 800) return "casual";
  if (elo <= 1100) return "developing";
  if (elo <= 1500) return "club";
  if (elo <= 1900) return "expert";
  if (elo <= 2300) return "master";
  return "elite";
}

function classifyMove(
  beforeFen: string,
  move: VerboseMove,
  moveNumber: number,
): MoveKind {
  if (move.san.includes("#")) return "mate";
  if (move.flags.includes("e")) return "en_passant";
  if (move.promotion) return "promote";
  if (move.flags.includes("k") || move.flags.includes("q")) return "castle";
  if (move.captured === "q") return "capture_queen";
  if (move.captured === "r") return "capture_rook";
  if (move.captured === "n" || move.captured === "b") return "capture_minor";
  if (move.captured === "p") return "capture_pawn";
  if (move.san.includes("+")) return "check";

  const before = new ChessEngine(beforeFen);
  if (before.inCheck()) return "escape_check";

  const backRank = move.color === "w" ? "1" : "8";
  if (
    (move.piece === "n" || move.piece === "b") &&
    move.from[1] === backRank &&
    moveNumber < 16
  ) {
    return "develop";
  }

  const center = new Set(["e4", "d4", "e5", "d5", "c4", "c5", "f4", "f5"]);
  if (move.piece === "p" && center.has(move.to) && moveNumber < 14) return "center";

  return "quiet";
}

function phase(moveNumber: number, fen: string): "opening" | "middlegame" | "endgame" {
  if (moveNumber < 14) return "opening";
  const board = fen.split(" ")[0] ?? "";
  const pieces = board.replace(/[^a-zA-Z]/g, "").length;
  if (pieces <= 12) return "endgame";
  return "middlegame";
}

function commentKind(ctx: MatchMoveContext, kind: MoveKind): MoveCommentKind {
  if (kind !== "quiet") return kind;
  const ph = phase(ctx.moveNumber, ctx.beforeFen);
  if (ph === "opening") return "quiet_opening";
  if (ph === "endgame") return "quiet_endgame";
  return "quiet_middlegame";
}

/** Bot line after a match move — bot identity × coach personality. */
export function commentOnMatchMove(ctx: MatchMoveContext): string {
  const kind = classifyMove(ctx.beforeFen, ctx.move, ctx.moveNumber);
  const raw = buildMoveComment(ctx, commentKind(ctx, kind));
  return applyCoachLine(raw, ctx.personality, "match");
}

export function matchGreeting(
  elo: number,
  botName: string,
  resumed: boolean,
  personality: CoachPersonality,
): string {
  const raw = buildMatchGreeting(elo, botName, personality, resumed);
  return applyCoachLine(raw, personality, "greeting");
}

export function passPlayGreeting(personality: CoachPersonality): string {
  return applyCoachLine(botPassPlayGreeting(personality), personality, "greeting");
}
