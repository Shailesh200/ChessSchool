import { chooseMove, eloToConfig } from "@/features/chess-engine/bot";
import { useSettings } from "@/core/store/settings.store";
import type { BoardArrow, VerboseMove } from "@/core/types/chess";
import {
  encourage as encourageFor,
  nudge as nudgeFor,
} from "./personality";
import {
  commentOnMatchMove,
  matchGreeting as matchGreetingFor,
  passPlayGreeting as passPlayGreetingFor,
} from "./matchCommentary";

/**
 * Coach voice — personalities retint feedback tone. Match commentary blends
 * bot tier (ELO band) with the user's coach personality from settings.
 */

export { applyCoachLine, personaOf } from "./personality";
export type { CoachContext } from "./personality";
export type { MatchMoveContext } from "./matchCommentary";

function personality() {
  return useSettings.getState().coachPersonality;
}

export function encourage(seed: number): string {
  return encourageFor(personality(), seed);
}

export function nudge(seed: number): string {
  return nudgeFor(personality(), seed);
}

export interface MatchCommentInput {
  beforeFen: string;
  move: VerboseMove;
  botElo: number;
  botName: string;
  reactingToPlayer: boolean;
  moveNumber: number;
}

/** Rich bot/coach line after a match move (tier + personality). */
export function commentOnMove(input: MatchCommentInput): string {
  return commentOnMatchMove({
    ...input,
    personality: personality(),
  });
}

export function matchGreeting(elo: number, botName: string, resumed: boolean): string {
  return matchGreetingFor(elo, botName, resumed, personality());
}

export function passPlayGreeting(): string {
  return passPlayGreetingFor(personality());
}

export function hintArrow(fen: string, strength = 1600): BoardArrow | null {
  const move = chooseMove(fen, eloToConfig(strength), 0.5);
  if (!move) return null;
  return { startSquare: move.from, endSquare: move.to, color: "#5b5bd6" };
}
