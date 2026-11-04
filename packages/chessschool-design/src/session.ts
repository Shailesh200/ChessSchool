import type { AuthResponse, GuestPayload, MeResponse } from "./api";
import { mergeProgress, sanitizeProgress, type LocalState } from "./progress";

/** What a device sends when it signs up or logs in, so the guest's work moves to the account. */
export function guestPayload(state: LocalState): GuestPayload {
  return {
    guestId: state.guestId,
    profile: {
      name: state.profile.name,
      who: state.profile.who,
      dailyMinutes: state.profile.dailyMinutes,
      appearance: state.prefs.appearance,
      sound: state.prefs.sound,
    },
    progress: state.progress,
  };
}

/** Applies a successful auth response; local progress is merged, never replaced. */
export function applyAuth(state: LocalState, auth: Pick<AuthResponse, "user" | "profile" | "progress">): LocalState {
  return {
    ...state,
    seenWelcome: true,
    account: auth.user,
    profile: {
      name: auth.user.name || state.profile.name,
      who: auth.profile.who ?? state.profile.who,
      dailyMinutes: auth.profile.dailyMinutes,
    },
    prefs: { ...state.prefs, appearance: auth.profile.appearance, sound: auth.profile.sound },
    progress: sanitizeProgress(mergeProgress(state.progress, auth.progress)),
    pendingCeremony: "saved",
  };
}

export function applyMe(state: LocalState, me: MeResponse): LocalState {
  return { ...state, account: me.user, profile: { ...state.profile, name: me.user.name || state.profile.name } };
}

/** Sign out keeps this device's progress (it is the learner's) but forgets the account. */
export function applySignOut(state: LocalState): LocalState {
  return { ...state, account: null, pendingCeremony: null };
}
