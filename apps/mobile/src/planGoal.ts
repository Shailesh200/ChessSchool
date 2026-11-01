/**
 * Snapshot change for a new daily goal. The goal is a last-writer value on the
 * server, so a change carries its own writer stamp. Without it the stamp is
 * missing, the stored goal wins, and a goal can only go up on this device.
 * Picking the goal that is already set changes nothing.
 */
export function withDailyGoal(
  snap: Record<string, unknown>,
  goalXp: number,
  now: number = Date.now(),
): Record<string, unknown> {
  if (snap.dailyGoalXp === goalXp) return snap;
  return { ...snap, dailyGoalXp: goalXp, goalUpdatedAt: now };
}
