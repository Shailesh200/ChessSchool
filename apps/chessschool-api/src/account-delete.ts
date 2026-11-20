import { eq, inArray, or } from "drizzle-orm";
import type { Db } from "./db";
import { growthDeletes } from "./growth";
import { playDeletes } from "./play";
import { blocks, childProgress, children, coachUsage, classes, follows, classGames, classMembers, feedback, homework, leaderboardHidden, profiles, progress, leagueMembers, leaguePlayers, ratingEvents, ratingHistory, ratings, reports, scanUsage, sessions, tournaments, users, visionScores, weeklySummary } from "./schema";

/**
 * Removes one user's rows: sessions, progress, profile, classes (with their homework, games and tournaments),
 * every class game they played (so opponents keep no half-game with a missing player), feedback,
 * ratings (theirs and their children's), league rows, then the user.
 * Runs as one batch, which libsql applies atomically on a local file and over HTTP; a BEGIN/COMMIT
 * pair over HTTP lands in separate requests, so each delete committed alone and COMMIT then failed.
 */
export async function deleteUserData(db: Db, userId: string): Promise<void> {
  const owned = await db.select({ id: classes.id }).from(classes).where(eq(classes.ownerId, userId));
  const ownedIds = owned.map((row) => row.id);
  const first = db.delete(classGames).where(or(eq(classGames.whiteId, userId), eq(classGames.blackId, userId)));
  await db.batch([
    first,
    db.delete(classMembers).where(eq(classMembers.userId, userId)),
    db.delete(homework).where(eq(homework.createdBy, userId)),
    db.delete(tournaments).where(eq(tournaments.createdBy, userId)),
    ...(ownedIds.length > 0
      ? [
          db.delete(classGames).where(inArray(classGames.classId, ownedIds)),
          db.delete(homework).where(inArray(homework.classId, ownedIds)),
          db.delete(tournaments).where(inArray(tournaments.classId, ownedIds)),
          db.delete(classMembers).where(inArray(classMembers.classId, ownedIds)),
          db.delete(classes).where(inArray(classes.id, ownedIds)),
        ]
      : []),
    db.delete(sessions).where(eq(sessions.userId, userId)),
    db.delete(follows).where(or(eq(follows.userId, userId), eq(follows.friendId, userId))),
    db.delete(progress).where(eq(progress.userId, userId)),
    db.delete(profiles).where(eq(profiles.userId, userId)),
    db.delete(feedback).where(eq(feedback.userId, userId)),
    db.delete(reports).where(or(eq(reports.reporterId, userId), eq(reports.reportedId, userId))),
    db.delete(leaderboardHidden).where(eq(leaderboardHidden.userId, userId)),
    db.delete(weeklySummary).where(eq(weeklySummary.userId, userId)),
    db.delete(childProgress).where(inArray(childProgress.childId, db.select({ id: children.id }).from(children).where(eq(children.userId, userId)))),
    db.delete(children).where(eq(children.userId, userId)),
    db.delete(visionScores).where(eq(visionScores.userId, userId)),
    db.delete(coachUsage).where(eq(coachUsage.userId, userId)),
    db.delete(scanUsage).where(eq(scanUsage.userId, userId)),
    db.delete(ratings).where(eq(ratings.userId, userId)),
    db.delete(ratingEvents).where(eq(ratingEvents.userId, userId)),
    db.delete(ratingHistory).where(eq(ratingHistory.userId, userId)),
    db.delete(blocks).where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId))),
    db.delete(leagueMembers).where(eq(leagueMembers.userId, userId)),
    db.delete(leaguePlayers).where(eq(leaguePlayers.userId, userId)),
    ...growthDeletes(db, userId),
    ...playDeletes(db, userId),
    db.delete(users).where(eq(users.id, userId)),
  ]);
}
