import type { DBGameSession } from "@/db/schema";
import { verifySeatToken } from "@/lib/session-secret";

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

/**
 * Same check as POST /api/session/[id]: `verifySeatToken` for a seat's user.
 * A guest presents the token without a session, so both seats are tried.
 * The token format is unchanged (`color` + HMAC of id, color, and user id).
 */
export function seatTokenMatchesSession(
  session: Pick<DBGameSession, "id" | "whiteUserId" | "blackUserId">,
  token: string,
): boolean {
  if (
    session.whiteUserId &&
    verifySeatToken(session.id, "w", session.whiteUserId, token)
  ) {
    return true;
  }
  if (
    session.blackUserId &&
    verifySeatToken(session.id, "b", session.blackUserId, token)
  ) {
    return true;
  }
  return false;
}
