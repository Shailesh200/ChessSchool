import {
  useProgression,
  progressSnapshot,
  type ProgressSnapshot,
} from "@/core/store/progression.store";
import { usePlan } from "@/core/store/plan.store";
import { useSession } from "@/core/store/session.store";

export type ServerSnapshot = ProgressSnapshot & {
  user: { name: string; role: string };
  homeworkStreak?: number;
  homeworkLastDay?: string | null;
};

/** The full push payload — progression snapshot + homework streak. */
export function fullSnapshot() {
  const p = progressSnapshot(useProgression.getState());
  const plan = usePlan.getState();
  return { ...p, homeworkStreak: plan.homeworkStreak, homeworkLastDay: plan.homeworkLastDay };
}

/**
 * Pull the account's progress and apply it. The account is the source of truth:
 * an established account REPLACES local state (hydrate); a brand-new account that
 * a guest just created instead absorbs the guest's local progress (merge-up).
 * Returns the user, or null if not logged in.
 */
export async function pullProgress(): Promise<{ name: string; role: string } | null> {
  let r: Response;
  try {
    r = await fetch("/api/progress");
  } catch {
    return null;
  }
  if (r.status === 401) {
    useSession.getState().setSession(false, null);
    return null;
  }
  if (!r.ok) return null;
  const data = (await r.json()) as ServerSnapshot;

  const local = progressSnapshot(useProgression.getState());
  const guestHadProgress = local.xp > 0 || Object.keys(local.lessons).length > 0;
  const accountEmpty = data.xp === 0 && Object.keys(data.lessons ?? {}).length === 0;

  if (accountEmpty && guestHadProgress) {
    useProgression.getState().mergeSnapshot(data); // guest → new account: carry progress up
  } else {
    useProgression.getState().hydrateSnapshot(data); // established account is authoritative
  }
  usePlan.getState().setHomework(data.homeworkStreak ?? 0, data.homeworkLastDay ?? null);
  useSession.getState().setSession(true, data.user);
  return data.user;
}
