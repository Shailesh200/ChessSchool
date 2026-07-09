import type { DBGameSession } from "@/db/schema";

export type SeatColor = "w" | "b";

/** Which seat (if any) this user owns in the game. */
export function seatColorForUser(
  session: DBGameSession,
  userId: string,
): SeatColor | null {
  if (session.whiteUserId === userId) return "w";
  if (session.blackUserId === userId) return "b";
  return null;
}

export function isParticipant(session: DBGameSession, userId: string): boolean {
  return seatColorForUser(session, userId) !== null;
}
