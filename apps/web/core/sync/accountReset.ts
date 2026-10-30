import { useProgression } from "@/core/store/progression.store";
import { usePlan } from "@/core/store/plan.store";
import { useSession } from "@/core/store/session.store";
import { useSettings } from "@/core/store/settings.store";
import { useMatch } from "@/core/store/match.store";
import { useArena } from "@/core/store/arena.store";
import { clearLocalRows } from "@/core/db/db";
import { clearGuestOwner, clearSignedInMarker } from "@/core/sync/guestOwner";

/**
 * Everything personal the web client keeps for a signed-in user, dropped on an explicit
 * logout or account deletion: progression, homework plan, the active match and arena run
 * (DP-W-001), every setting back to its default, the Dexie journal / games / reviews
 * (the bleed P0: they were never cleared and were pushed into the next account), the
 * kept-copy owner tag and the signed-in marker, and the session itself.
 * Call it AFTER the server call: a push in flight before then must not send an emptied
 * journal to the account being left. A failed Dexie clear is not fatal: rows are owner-tagged
 * and filtered on read and push, and pullProgress reconciles them on the next sign-in.
 */
export async function resetLocalAccountState(): Promise<void> {
  useProgression.getState().reset();
  // An explicit logout leaves no kept copy or owner tag behind, even for the same user.
  clearGuestOwner();
  clearSignedInMarker();
  usePlan.setState({
    routineDay: null,
    routineDone: [],
    homeworkStreak: 0,
    homeworkLastDay: null,
  });
  useMatch.getState().clear();
  useArena.getState().abandon();
  useSettings.getState().reset(); // back to the defaults, incl. the default opponent
  useSession.getState().setSession(false, null);
  try {
    await clearLocalRows();
  } catch {
    /* rows are owner-tagged; see above */
  }
}
