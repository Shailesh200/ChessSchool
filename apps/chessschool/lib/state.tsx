import {
  STORAGE_KEY,
  applyAuth,
  dayKey,
  minutesToday,
  applyMe,
  applySignOut,
  arrive,
  completeNode,
  createUsage,
  forgetProfile,
  freshSlice,
  mergeProgress,
  placeBefore,
  sanitizeProgress,
  switchProfile,
  type AvatarId,
  langFor,
  language,
  setLanguage,
  ideaRef,
  reviewAfter,
  placeAt,
  recordGame,
  recordPractice,
  recordPuzzle,
  recordSprint,
  recordVision,
  serveDaily,
  type GameRecord,
  type Placement,
  createInitialState,
  hydrateState,
  resetDevice,
  type AuthResponse,
  type LocalState,
  type Prefs,
  type Profile,
  type RoomId,
  type SavedGame,
  type SoundCue,
  type LessonMeta,
  type PracticeItem,
  type UsageEventName,
} from "@chessschool/design";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { randomUUID } from "expo-crypto";
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { api, token } from "./api";
import { feedback } from "./feedback";
import { setFontsFor } from "./theme";
import { googleSignOut } from "./google";
import { syncReminders } from "./notifications";

type Store = {
  ready: boolean;
  state: LocalState;
  setProfile: (p: Partial<Profile>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  setSeenWelcome: () => void;
  completeOrientation: () => void;
  completeLesson: (id: string, meta?: LessonMeta) => void;
  finishPractice: () => void;
  finishGame: (game: GameRecord, minutes: number) => void;
  finishPuzzle: (p: { id: string; solved: boolean; newRating: number; daily?: boolean }) => void;
  serveDailyPuzzle: (day: string, id: string, puzzle?: { id: string; fen: string; moves: string[]; rating: number; themes: readonly string[] } | null) => void;
  finishSprint: (score: number, minutes: number) => void;
  /** Keeps a board-vision best on the device and, signed in, sends it for the class board. */
  finishVision: (game: string, score: number) => void;
  place: (level: Placement) => void;
  markBadgesSeen: (ids: string[]) => void;
  deleteAccount: () => Promise<void>;
  saveGame: (game: SavedGame | null) => void;
  clearArrival: () => void;
  signedIn: (auth: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
  resetThisDevice: () => Promise<void>;
  clearCeremony: () => void;
  toggleRoomReminder: (id: RoomId) => void;
  markNotificationOffered: () => void;
  cue: (c: SoundCue) => void;
  /** Makes a child (or, with null, the account's own profile) the active learner. */
  switchLearner: (child: { id: string; name: string; avatar: AvatarId } | null) => Promise<void>;
  /** Removes a child from this device after the server deleted them. */
  forgetLearner: (id: string) => void;
  setParentPin: (pin: string | null) => void;
  /** Placement quiz result: lessons before `startAt` count as known. */
  placeBefore: (order: readonly string[], startAt: string) => void;
  /** Records a practice answer for spaced review. */
  answerReview: (ref: string, missed: boolean) => void;
  /** Flashcards: "I remembered" moves the card on; "Show again" brings it back tomorrow. */
  answerIdea: (lessonId: string, remembered: boolean) => void;
  /** Stores the next practice set for offline use. */
  setPracticeNext: (items: PracticeItem[]) => void;
  /** Anonymous usage event (dropped when "Share anonymous usage" is off). */
  track: (name: UsageEventName, extra?: { lesson?: string; step?: number; value?: number }) => void;
};

const Ctx = createContext<Store | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocalState>(() => createInitialState("pending"));
  const [ready, setReady] = useState(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef("");
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });
  const [usage] = useState(() =>
    createUsage({
      send: api.sendUsage,
      install: () => latest.current.usageId,
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: Constants.expoConfig?.version ?? "0.0.0",
      enabled: () => latest.current.prefs.shareUsage,
    }),
  );
  useEffect(() => {
    if (!ready) return;
    usage.track("app_open");
    const sub = AppState.addEventListener("change", (s) => s !== "active" && void usage.flush());
    return () => sub.remove();
  }, [ready, usage]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        let parsed: unknown = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {}
        setState(arrive(hydrateState(parsed, randomUUID), new Date()));
      })
      .catch(() => setState(createInitialState(randomUUID())))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const accountId = state.account?.id;
  useEffect(() => {
    if (!ready || !accountId) return;
    api
      .me()
      .then((me) => setState((s) => applyMe(s, me)))
      .catch((err) => {
        if (err?.status === 401) {
          void token.clear();
          setState((s) => applySignOut(s));
        }
      });
  }, [ready, accountId]);

  const progressJson = JSON.stringify(state.progress);
  useEffect(() => {
    if (!ready || !accountId || progressJson === lastPushed.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      const child = latest.current.activeChild;
      (child ? api.putChildProgress(child, JSON.parse(progressJson)) : api.putProgress(JSON.parse(progressJson)))
        .then(() => {
          lastPushed.current = progressJson;
        })
        .catch(() => {});
    }, 800);
  }, [ready, accountId, progressJson]);

  // Re-plan reminders when anything that changes them changes (goal met today, hour, name, streak).
  const today = dayKey(new Date());
  const reminderKey = [state.prefs.notifications, state.prefs.reminderHour, state.profile.name, state.profile.dailyMinutes, minutesToday(state.progress, today), state.progress.streak.lastDay, today].join("|");
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void syncReminders(latest.current), 600);
    return () => clearTimeout(t);
  }, [ready, reminderKey]);

  const { sound, haptics } = state.prefs;
  const cue = useCallback((c: SoundCue) => feedback(c, { sound, haptics }), [sound, haptics]);

  const store = useMemo<Store>(
    () => ({
      ready,
      state,
      cue,
      track: usage.track,
      switchLearner: async (child) => {
        setState((s) => switchProfile(s, child?.id ?? null, child ? freshSlice(s, child.name, child.avatar) : undefined));
        if (!child) return;
        // A child's progress may have been saved from another device.
        const remote = await api.childProgress(child.id).catch(() => null);
        if (remote) setState((s) => (s.activeChild === child.id ? { ...s, progress: sanitizeProgress(mergeProgress(s.progress, remote.progress), null) } : s));
      },
      forgetLearner: (id) => setState((s) => forgetProfile(s, id)),
      setParentPin: (pin) => setState((s) => ({ ...s, parentPin: pin })),
      placeBefore: (order, startAt) => setState((s) => placeBefore(s, order, startAt, new Date())),
      answerReview: (ref, missed) => setState((s) => ({ ...s, review: reviewAfter(s.review, ref, missed, dayKey(new Date())) })),
      answerIdea: (lessonId, remembered) => setState((s) => ({ ...s, ideas: reviewAfter(s.ideas, ideaRef(lessonId), !remembered, dayKey(new Date())) })),
      setPracticeNext: (items) => setState((s) => ({ ...s, practiceNext: items })),
      setProfile: (p) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      setPrefs: (p) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
      setSeenWelcome: () => setState((s) => ({ ...s, seenWelcome: true })),
      completeOrientation: () => setState((s) => completeNode(s, "meet", new Date())),
      completeLesson: (id, meta) => {
        usage.track("lesson_finish", { lesson: id });
        setState((s) => completeNode(s, id, new Date(), meta));
      },
      finishPractice: () => {
        usage.track("practice_finished");
        setState((s) => recordPractice(s, new Date()));
      },
      finishGame: (game, minutes) => {
        usage.track("game_finished");
        setState((s) => recordGame(s, game, new Date(), minutes));
      },
      finishPuzzle: (p) => {
        usage.track(p.solved ? "puzzle_solved" : "puzzle_failed");
        setState((s) => recordPuzzle(s, p, new Date()));
      },
      serveDailyPuzzle: (day, id, puzzle) => setState((s) => serveDaily(s, day, id, puzzle)),
      finishSprint: (score, minutes) => setState((s) => recordSprint(s, score, new Date(), minutes)),
      finishVision: (game, score) => {
        setState((s) => recordVision(s, game, score));
        if (latest.current.account && score > 0) api.sendVisionScore(game, score, dayKey(new Date())).catch(() => {});
      },
      place: (level) => setState((s) => placeAt(s, level, new Date())),
      markBadgesSeen: (ids) => setState((s) => ({ ...s, badgesSeen: [...new Set([...s.badgesSeen, ...ids])] })),
      deleteAccount: async () => {
        await api.deleteMe();
        await token.clear();
        await googleSignOut();
        setState((s) => applySignOut(s));
      },
      saveGame: (game) => setState((s) => ({ ...s, activeGame: game })),
      clearArrival: () => setState((s) => ({ ...s, arrival: null })),
      signedIn: async (auth) => {
        await token.set(auth.token);
        lastPushed.current = JSON.stringify(auth.progress);
        setState((s) => applyAuth(s, auth));
      },
      signOut: async () => {
        await api.logout().catch(() => {});
        await token.clear();
        await googleSignOut();
        setState((s) => applySignOut(s));
      },
      resetThisDevice: async () => {
        await token.clear();
        setState(resetDevice(randomUUID()));
      },
      clearCeremony: () => setState((s) => ({ ...s, pendingCeremony: null })),
      toggleRoomReminder: (id) =>
        setState((s) => ({
          ...s,
          roomReminders: s.roomReminders.includes(id) ? s.roomReminders.filter((r) => r !== id) : [...s.roomReminders, id],
        })),
      markNotificationOffered: () => setState((s) => ({ ...s, notificationOffered: true })),
    }),
    [ready, state, cue, usage],
  );

  // The language and font are applied before children render; changing either remounts the tree so every screen re-reads them.
  const lang = state.prefs.lang ?? langFor(Intl.DateTimeFormat().resolvedOptions().locale);
  if (language() !== lang) setLanguage(lang);
  setFontsFor(lang, state.prefs.easyFont);
  return (
    <Ctx.Provider value={store}>
      <Fragment key={`${lang}-${state.prefs.easyFont}`}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppStateProvider");
  return v;
}
