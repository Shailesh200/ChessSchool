import { eq, inArray, or } from "drizzle-orm";
import type { Db } from "./db";
import { blocks, classMembers, classes, feedback, profiles, progress, reports, sessions, users } from "./schema";

/**
 * Removes one user's rows: sessions, progress, profile, classes, feedback, then the user.
 * Runs as one batch, which libsql applies atomically on a local file and over HTTP; a BEGIN/COMMIT
 * pair over HTTP lands in separate requests, so each delete committed alone and COMMIT then failed.
 */
export async function deleteUserData(db: Db, userId: string): Promise<void> {
  const owned = await db.select({ id: classes.id }).from(classes).where(eq(classes.ownerId, userId));
  const ownedIds = owned.map((row) => row.id);
  const first = db.delete(classMembers).where(eq(classMembers.userId, userId));
  await db.batch([
    first,
    ...(ownedIds.length > 0
      ? [db.delete(classMembers).where(inArray(classMembers.classId, ownedIds)), db.delete(classes).where(inArray(classes.id, ownedIds))]
      : []),
    db.delete(sessions).where(eq(sessions.userId, userId)),
    db.delete(progress).where(eq(progress.userId, userId)),
    db.delete(profiles).where(eq(profiles.userId, userId)),
    db.delete(feedback).where(eq(feedback.userId, userId)),
    db.delete(reports).where(or(eq(reports.reporterId, userId), eq(reports.reportedId, userId))),
    db.delete(blocks).where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId))),
    db.delete(users).where(eq(users.id, userId)),
  ]);
}
