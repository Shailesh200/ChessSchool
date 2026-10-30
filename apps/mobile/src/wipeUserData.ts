import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { progressStore } from "@/progressStore";
import { settings } from "@/settings";
import { cacheClear } from "@/dataCache";
import { resetMatchStore } from "@/matchStore";
import { resetArenaStore } from "@/arenaStore";
import { clearAllOnlineSeats } from "@/onlineSeat";
import { rotateAnalyticsSession } from "@/productAnalytics/track";

/**
 * The one wipe of a user's data on this device. Logout, account deletion and a 401
 * (expired session) all call it, so no path leaves less behind than another (DP-M-001..004).
 *
 *   import { wipeUserData } from "@/wipeUserData";
 *   await wipeUserData();                    // logout / delete account
 *   await wipeUserData({ expired: true });   // 401: the in-flight edit stays as guest progress
 *
 * It clears: the progress cache, the signed-in guest copy, the recent-games cache and the
 * last-user id (progressStore), settings (memory and disk, back to defaults), the Academy
 * data cache, the active match, the arena run, the online seats, and it rotates the
 * analytics session, and deletes the cached `chessschool.lastUser`. It never touches the session token or the orientation flag.
 *
 * An expiry (`expired: true`) keeps what the (g)-(k) progress policy keeps on purpose: the
 * copy kept for the expired user (tagged to its owner, merged back only for them), the
 * owner-tagged games cache and the last-user id.
 *
 * Resolves when every key is gone. Never throws: a store that fails to clear must not stop
 * the sign-out (the next sign-in still starts from its own account).
 */
/**
 * `chessschool.lastUser` (the cached signed-in user, added by the DP-M-005 offline-session
 * change): a user key on every wipe, an expiry included. Fails closed like clearToken():
 * a missing key or a delete error is not an error here.
 */
const LAST_USER_KEY = "chessschool.lastUser";
async function clearLastUser(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.removeItem(LAST_USER_KEY);
    } else {
      await SecureStore.deleteItemAsync(LAST_USER_KEY);
    }
  } catch {
    /* nothing to delete, or it cannot be deleted: the sign-out goes on */
  }
}

export async function wipeUserData(opts: { expired?: boolean } = {}): Promise<void> {
  if (opts.expired) progressStore.expire();
  else progressStore.clear();
  settings.reset();
  cacheClear();
  await Promise.all(
    [
      progressStore.settled(),
      resetMatchStore(),
      resetArenaStore(),
      clearAllOnlineSeats(),
      clearLastUser(),
      rotateAnalyticsSession(),
    ].map((p) => p.catch(() => undefined)),
  );
}
