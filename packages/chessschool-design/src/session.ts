import type { AuthResponse, GuestPayload, MeResponse } from "./api";
import { copy } from "./copy";
import { mergeProgress, sanitizeProgress, type Account, type LocalState } from "./progress";
import { switchProfile } from "./profiles";

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
      avatar: state.profile.avatar,
      flair: state.profile.flair,
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
      avatar: auth.profile.avatar || state.profile.avatar,
      flair: auth.profile.flair ?? state.profile.flair,
    },
    prefs: { ...state.prefs, appearance: auth.profile.appearance, sound: auth.profile.sound },
    progress: sanitizeProgress(mergeProgress(state.progress, auth.progress), null),
    pendingCeremony: "saved",
  };
}

export function applyMe(state: LocalState, me: MeResponse): LocalState {
  // While a child profile is active, the account name belongs to the parked parent profile.
  const main = state.parked.main;
  if (state.activeChild && main) return { ...state, account: me.user, parked: { ...state.parked, main: { ...main, profile: { ...main.profile, name: me.user.name || main.profile.name } } } };
  return { ...state, account: me.user, profile: { ...state.profile, name: me.user.name || state.profile.name } };
}

/** Sign out keeps this device's progress (it is the learner's) but forgets the account and its child profiles. */
export function applySignOut(state: LocalState): LocalState {
  const main = state.activeChild ? switchProfile(state, null) : state;
  return { ...main, account: null, pendingCeremony: null, activeChild: null, parked: {} };
}

/** Visible name of how this account signs in. */
export function signInProviderLabel(provider: Account["provider"]): string {
  switch (provider) {
    case "password":
      return copy.auth.providerPassword;
    case "google":
      return copy.auth.providerGoogle;
    case "apple":
      return copy.auth.providerApple;
  }
}

/** Email accounts can set a password. Google and Apple cannot. */
export function canChangePassword(provider: Account["provider"]): boolean {
  switch (provider) {
    case "password":
      return true;
    case "google":
    case "apple":
      return false;
  }
}
