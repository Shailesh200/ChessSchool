import { chooseMove, eloToConfig } from "@/features/chess-engine/bot";
import { useSettings } from "@/core/store/settings.store";
import type { BoardArrow, VerboseMove } from "@/core/types/chess";
import { encourage as encourageFor, nudge as nudgeFor } from "./personality";
import {
  commentOnMatchMove,
  matchGreeting as matchGreetingFor,
  passPlayGreeting as passPlayGreetingFor,
} from "./matchCommentary";
import { buildMatchRecap, type GameRecapInput } from "./gameRecap";
import {
  calculationPrompt,
  confirmMovePrompt,
  thinkingMatchGreeting,
} from "./thinkingPrompt";
import {
  shadowGreeting as shadowGreetingFor,
  shadowMoveLine as shadowMoveLineFor,
  shadowOffBookLine as shadowOffBookLineFor,
} from "./shadowCoach";

/**
 * Coach voice — personalities retint feedback tone. Match commentary blends
 * bot tier (ELO band) with the user's coach personality from settings.
 */

export { applyCoachLine, personaOf } from "./personality";
export type { CoachContext } from "./personality";
export type { MatchMoveContext } from "./matchCommentary";
export type { GameRecapInput } from "./gameRecap";

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

export function thinkingGreeting(elo: number, botName: string): string {
  return thinkingMatchGreeting(elo, botName, personality());
}

export function calculationCoachPrompt(
  moveNumber: number,
  inCheck: boolean,
  botElo: number,
): string {
  return calculationPrompt(personality(), botElo, moveNumber, inCheck);
}

export function confirmCoachMove(san: string): string {
  return confirmMovePrompt(san, personality());
}

export function passPlayGreeting(): string {
  return passPlayGreetingFor(personality());
}

export function shadowGreeting(
  opponentName: string,
  playerColor: "w" | "b",
  flipped: boolean,
): string {
  return shadowGreetingFor(personality(), opponentName, playerColor, flipped);
}

export function shadowMoveLine(san: string, opponentName: string): string {
  return shadowMoveLineFor(personality(), san, opponentName);
}

export function shadowOffBookLine(): string {
  return shadowOffBookLineFor(personality());
}

export function matchRecap(input: Omit<GameRecapInput, "personality">): string {
  return buildMatchRecap({ ...input, personality: personality() });
}

export function hintArrow(fen: string, strength = 1600): BoardArrow | null {
  const move = chooseMove(fen, eloToConfig(strength), 0.5);
  if (!move) return null;
  return { startSquare: move.from, endSquare: move.to, color: "#5b5bd6" };
}
