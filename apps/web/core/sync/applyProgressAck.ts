import { readProgressPushAck } from "@chess-school/progression";
import { usePlan } from "@/core/store/plan.store";
import { useProgression } from "@/core/store/progression.store";

/**
 * Copy the merged fields from POST /api/progress into the local stores.
 * An old `{ ok, count }` body changes nothing. Equal values are left alone
 * so adopting the ack does not schedule another push.
 */
export function applyServerProgressAck(body: unknown): void {
  const ack = readProgressPushAck(body);
  if (!ack) return;

  const progress = useProgression.getState();
  const patch: Partial<typeof progress> = {};
  if (ack.streak !== undefined && ack.streak !== progress.streak) patch.streak = ack.streak;
  if (ack.lastActiveDay !== undefined && ack.lastActiveDay !== progress.lastActiveDay) {
    patch.lastActiveDay = ack.lastActiveDay;
  }
  if (ack.rating !== undefined && ack.rating !== progress.rating) patch.rating = ack.rating;
  if (ack.dailyGoalXp !== undefined && ack.dailyGoalXp !== progress.dailyGoalXp) {
    patch.dailyGoalXp = ack.dailyGoalXp;
  }
  if (Object.keys(patch).length > 0) useProgression.setState(patch);

  if (
    ack.homeworkStreak !== undefined &&
    ack.homeworkStreak !== usePlan.getState().homeworkStreak
  ) {
    usePlan.getState().adoptHomework(ack.homeworkStreak);
  }
}
