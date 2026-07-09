import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gameSessions } from "@/db/schema";

/** CSPRNG game id with collision retry. */
export async function createGameSessionId(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const id = randomUUID();
    const existing = (
      await db
        .select({ id: gameSessions.id })
        .from(gameSessions)
        .where(eq(gameSessions.id, id))
        .limit(1)
    )[0];
    if (!existing) return id;
  }
  throw new Error("failed to allocate game session id");
}

export { isParticipant, seatColorForUser, type SeatColor } from "./game-session-seat";
