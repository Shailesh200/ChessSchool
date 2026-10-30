import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { progress, users, type DBGameSession } from "@/db/schema";
import { parseExtraData } from "@/lib/progress-merge";
import { seatColorForUser } from "@/lib/game-session";

export type SessionSeatPublic = {
  seat: "w" | "b";
  name: string;
  rating: number;
  userId?: string;
};

export async function loadSessionSeatProfiles(
  session: Pick<DBGameSession, "whiteUserId" | "blackUserId">,
): Promise<{ w?: SessionSeatPublic; b?: SessionSeatPublic }> {
  const ids = [session.whiteUserId, session.blackUserId].filter(Boolean) as string[];
  if (!ids.length) return {};
  const names = new Map(
    (
      await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, ids))
    ).map((r) => [r.id, r.name] as const),
  );
  const ratings = new Map(
    (
      await db
        .select({ userId: progress.userId, data: progress.data })
        .from(progress)
        .where(inArray(progress.userId, ids))
    ).map((r) => [r.userId, parseExtraData(r.data).rating ?? 800] as const),
  );
  const out: { w?: SessionSeatPublic; b?: SessionSeatPublic } = {};
  if (session.whiteUserId) {
    out.w = {
      seat: "w",
      name: names.get(session.whiteUserId) ?? "White",
      rating: ratings.get(session.whiteUserId) ?? 800,
    };
  }
  if (session.blackUserId) {
    out.b = {
      seat: "b",
      name: names.get(session.blackUserId) ?? "Black",
      rating: ratings.get(session.blackUserId) ?? 800,
    };
  }
  return out;
}

export function attachParticipantIds(
  seats: { w?: SessionSeatPublic; b?: SessionSeatPublic },
  session: Pick<DBGameSession, "whiteUserId" | "blackUserId">,
  viewerId: string,
): { w?: SessionSeatPublic; b?: SessionSeatPublic } {
  const next = { ...seats };
  if (next.w && session.whiteUserId === viewerId) next.w = { ...next.w, userId: viewerId };
  if (next.b && session.blackUserId === viewerId) next.b = { ...next.b, userId: viewerId };
  return next;
}

export function viewerSeat(
  session: DBGameSession,
  user: { id: string } | null,
): "w" | "b" | null {
  if (!user) return null;
  return seatColorForUser(session, user.id);
}
