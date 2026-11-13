import { eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import { classMembers, classes, feedback, profiles, progress, sessions, users } from "./schema";

/**
 * Removes one user's rows on this connection: sessions, progress, profile, classes, feedback, then the user.
 * libsql's interactive `transaction()` opens another connection, which does not see a local sqlite database,
 * so the statements run inside BEGIN/COMMIT on the same client that created the tables.
 */
export async function deleteUserData(db: Db, userId: string): Promise<void> {
  const client = db.$client;
  await client.execute("BEGIN");
  try {
    const owned = await db.select({ id: classes.id }).from(classes).where(eq(classes.ownerId, userId));
    const ownedIds = owned.map((row) => row.id);
    if (ownedIds.length > 0) {
      await db.delete(classMembers).where(inArray(classMembers.classId, ownedIds));
      await db.delete(classes).where(inArray(classes.id, ownedIds));
    }
    await db.delete(classMembers).where(eq(classMembers.userId, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(progress).where(eq(progress.userId, userId));
    await db.delete(profiles).where(eq(profiles.userId, userId));
    await db.delete(feedback).where(eq(feedback.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    await client.execute("COMMIT");
  } catch (err) {
    await client.execute("ROLLBACK");
    throw err;
  }
}
