import type { VerboseMove } from "@chess-school/core";
import { commentOnMatchMove, matchGreeting, type CoachPersonality } from "./coaching/matchCommentary";
import { normalizeCoachCharacter } from "./coachCharacters";

export type { CoachPersonality };

export function commentOnMove(input: {
  beforeFen: string;
  move: VerboseMove;
  botElo: number;
  botName: string;
  personality: CoachPersonality;
  reactingToPlayer: boolean;
  moveNumber: number;
}): string {
  return commentOnMatchMove(input);
}

export function coachGreeting(
  elo: number,
  botName: string,
  resumed: boolean,
  personality: CoachPersonality,
): string {
  return matchGreeting(elo, botName, resumed, personality);
}

export function normalizeCoachPersonality(id: string | undefined): CoachPersonality {
  return normalizeCoachCharacter(id);
}
