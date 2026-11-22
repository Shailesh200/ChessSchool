import type { CoachId } from "./coaches";
import { emptyHabit, emptyProgress, type AvatarId, type Habit, type LocalState } from "./progress";
import { emptyQuests } from "./quests";
import { emptyRatings } from "./rating";

/** What belongs to one learner on a shared device. Everything else (account, look, sounds) is shared. */
export type ProfileSlice = Pick<LocalState, "profile" | "progress" | "review" | "practiceNext" | "endgames" | "placementDone" | "gameLog" | "activeGame" | "badgesSeen" | "quests" | "vision" | "ideas" | "mistakes" | "ratings"> & { coach: CoachId | null; habit?: Habit };

export const MAIN_PROFILE = "main";

const sliceOf = (s: LocalState): ProfileSlice => ({
  profile: s.profile,
  progress: s.progress,
  review: s.review,
  practiceNext: s.practiceNext,
  endgames: s.endgames,
  placementDone: s.placementDone,
  gameLog: s.gameLog,
  activeGame: s.activeGame,
  badgesSeen: s.badgesSeen,
  quests: s.quests,
  vision: s.vision,
  ideas: s.ideas,
  mistakes: s.mistakes,
  ratings: s.ratings,
  coach: s.prefs.coach,
  habit: s.habit,
});

/** A new child's starting point: their own name and picture, the parent's daily goal. */
export const freshSlice = (s: LocalState, name: string, avatar: AvatarId): ProfileSlice => ({
  profile: { ...s.profile, name, avatar, who: "child", flair: null },
  progress: emptyProgress(),
  review: {},
  practiceNext: [],
  endgames: {},
  placementDone: false,
  gameLog: [],
  activeGame: null,
  badgesSeen: [],
  quests: emptyQuests(),
  vision: {},
  ideas: {},
  mistakes: [],
  ratings: emptyRatings(),
  coach: null,
  habit: emptyHabit(),
});

/**
 * Makes `to` the active learner (null = the account's own profile). The current learner's slice is
 * parked; `fresh` is used when `to` has never been on this device.
 */
export function switchProfile(s: LocalState, to: string | null, fresh?: ProfileSlice): LocalState {
  const from = s.activeChild ?? MAIN_PROFILE;
  const target = to ?? MAIN_PROFILE;
  if (from === target) return s;
  const { [target]: next, ...rest } = s.parked;
  const slice = next ?? fresh;
  if (!slice) return s;
  const { coach, ...own } = slice;
  return { ...s, ...own, mistakes: own.mistakes ?? [], ratings: own.ratings ?? emptyRatings(), habit: own.habit ?? emptyHabit(), prefs: { ...s.prefs, coach }, activeChild: to, parked: { ...rest, [from]: sliceOf(s) } };
}

/** Drops a removed child from this device (switching back to the account first if they're active). */
export function forgetProfile(s: LocalState, id: string): LocalState {
  const back = s.activeChild === id ? switchProfile(s, null) : s;
  const { [id]: _gone, ...parked } = back.parked;
  return { ...back, parked };
}

/**
 * Child profiles were removed in Phase 5. A device that was on a child's profile goes back to the account's own
 * profile (its progress syncs as before); the child's slice stays parked on the device, never deleted. The PIN goes.
 */
export function mainProfile(s: LocalState): LocalState {
  const back = s.activeChild ? switchProfile(s, null) : s;
  // switchProfile keeps the child only when the main slice is missing; then the device keeps learning on what it has.
  return { ...back, activeChild: null, parentPin: null };
}

