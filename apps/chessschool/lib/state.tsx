import { botInfo, ENDGAME_IDS, isBotId } from "@chessschool/chess";
import {
  STORAGE_KEY,
  adoptRatings,
  addFreezes,
  FREEZE_MAX,
  dismissCelebration,
  withCelebrations,
  queueRating,
  ratedGame,
  ratedPuzzle,
  drainQueues,
  queueVisionScore,
  type RateInput,
  type RatedResult,
  applyAuth,
  dayKey,
  minutesToday,
  applyMe,
  applySignOut,
  arrive,
  completeNode,
  recordCombo,
  answerIdeaCard,
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
  answerPractice,
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
import { setAnalyticsAllowed, track as pulseTrack, flushAnalytics } from "@/lib/analytics";
import { botGameProps, pulseForUsage, settingsProps } from "@chessschool/design";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import { randomUUID } from "expo-crypto";
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { api, token } from "./api";
import { INVITE_KEY } from "./share";
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
  /** `flow` is the lesson's run: perfect (no miss, no hint) adds the bonus once; `best` counts for the combo quests. */
  completeLesson: (id: string, meta?: LessonMeta, flow?: { perfect: boolean; best: number }) => void;
  finishPractice: () => void;
  finishGame: (game: GameRecord, minutes: number) => void;
  /** `puzzleRating` also counts the attempt toward the playing rating. */
  finishPuzzle: (p: { id: string; solved: boolean; newRating: number; daily?: boolean; themes?: readonly string[]; puzzleRating?: number }) => void;
  /** Applies a pure state change from @chessschool/design (AI setting, imported games, reviewed-game skills). */
  update: (fn: (s: LocalState) => LocalState) => void;
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
  /** The learner closed the full-screen celebration `id`; it never shows again. */
  dismissCelebration: (id: string) => void;
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
  );  /** One call feeds the in-house usage counts and Pulse. */
  const both = useCallback((name: UsageEventName, extra?: { lesson?: string; step?: number; value?: number }) => {
    usage.track(name, extra);
    const ev = pulseForUsage(name, extra);
    if (ev) pulseTrack(ev[0], ev[1]);
  }, [usage]);
  useEffect(() => setAnalyticsAllowed(state.prefs.shareUsage), [state.prefs.shareUsage]);

  useEffect(() => {
    if (!ready) return;
    usage.track("app_open");
    const sub = AppState.addEventListener("change", (s) => s !== "active" && (void usage.flush(), flushAnalytics()));
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
      .then((me) => {
        setState((s) => applyMe(s, me));
        void settleInvites();
        const child = latest.current.activeChild;
        return api.rating(child).then((r) => setState((s) => adoptRatings(s, child, r.ratings)));
      })
      .catch((err) => {
        if (err?.status === 401) {
          void token.clear();
          setState((s) => applySignOut(s));
        }
      });
  }, [ready, accountId]);

  // Back online, or back in the app: try again.
  const [netTick, setNetTick] = useState(0);
  useEffect(() => {
    const bump = () => setNetTick((n) => n + 1);
    const net = NetInfo.addEventListener((n) => n.isConnected !== false && n.isInternetReachable !== false && bump());
    const app = AppState.addEventListener("change", (a) => a === "active" && bump());
    return () => {
      net();
      app.remove();
    };
  }, []);

  /** Signed in on the account's own profile: accept an invite link opened earlier, then move any banked reward freezes into the streak. */
  const settleInvites = async () => {
    if (latest.current.activeChild) return;
    const code = await AsyncStorage.getItem(INVITE_KEY).catch(() => null);
    if (code) void AsyncStorage.removeItem(INVITE_KEY).catch(() => {});
    if (code) await api.acceptInvite(code).catch(() => {});
    const have = latest.current.progress.streak.freezes ?? 0;
    const got = await api.claimFreezes(Math.min(have, FREEZE_MAX)).catch(() => null);
    if (got?.freezes) setState((s) => (s.activeChild ? s : addFreezes(s, got.freezes)));
  };

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
  }, [ready, accountId, progressJson, netTick]);

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

  /** A change the learner earned something by (lesson, game, puzzle): queues any celebration it unlocks. */
  const earn = (fn: (s: LocalState) => LocalState) => setState((s) => withCelebrations(s, fn(s), new Date()));

  /** Counts a bot game or puzzle on the device now and queues it for the server. */
  const rate = (rated: { input: RateInput; result: RatedResult } | null) => {
    if (rated) earn((s) => queueRating(s, rated));
  };

  // Signed in: send what was queued offline, oldest first (rated results, then other writes). The server
  // dedupes, and its ratings replace the device's only once nothing for that learner is left unsent.
  // A failed send keeps its place and waits for the connection to come back.
  const flushing = useRef(false);
  const queued = state.ratingQueue.length + state.writeQueue.length;
  useEffect(() => {
    if (!ready || !accountId || !queued || flushing.current) return;
    flushing.current = true;
    void drainQueues(() => latest.current, setState, api).then((sent) => {
      flushing.current = false;
      // Anything queued while this ran goes out next.
      if (sent) setNetTick((n) => n + 1);
    });
  }, [ready, accountId, queued, netTick]);

  const store = useMemo<Store>(
    () => ({
      ready,
      state,
      cue,
      track: both,
      switchLearner: async (child) => {
        setState((s) => switchProfile(s, child?.id ?? null, child ? freshSlice(s, child.name, child.avatar) : undefined));
        const id = child?.id ?? null;
        api
          .rating(id)
          .then((r) => setState((s) => adoptRatings(s, id, r.ratings)))
          .catch(() => {});
        if (!child) return;
        // A child's progress may have been saved from another device.
        const remote = await api.childProgress(child.id).catch(() => null);
        if (remote) setState((s) => (s.activeChild === child.id ? { ...s, progress: sanitizeProgress(mergeProgress(s.progress, remote.progress), null) } : s));
      },
      forgetLearner: (id) => setState((s) => forgetProfile(s, id)),
      setParentPin: (pin) => setState((s) => ({ ...s, parentPin: pin })),
      placeBefore: (order, startAt) => setState((s) => placeBefore(s, order, startAt, new Date())),
      answerReview: (ref, missed) => setState((s) => answerPractice(s, ref, missed, dayKey(new Date()))),
      update: (fn) => setState(fn),
      answerIdea: (lessonId, remembered) => setState((s) => answerIdeaCard(s, lessonId, remembered, new Date())),
      setPracticeNext: (items) => setState((s) => ({ ...s, practiceNext: items })),
      setProfile: (p) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      setPrefs: (p) => {
        for (const props of settingsProps(p)) pulseTrack("settings_change", props);
        setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } }));
      },
      setSeenWelcome: () => setState((s) => ({ ...s, seenWelcome: true })),
      completeOrientation: () => {
        pulseTrack("first_lesson_finish", { lesson: "meet" });
        earn((s) => completeNode(s, "meet", new Date()));
      },
      completeLesson: (id, meta, flow) => {
        both("lesson_finish", { lesson: id });
        const now = new Date();
        earn((s) => recordCombo(completeNode(s, id, now, meta, flow?.perfect), flow?.best ?? 0, now));
      },
      finishPractice: () => {
        usage.track("practice_finished");
        earn((s) => recordPractice(s, new Date()));
      },
      finishGame: (game, minutes) => {
        usage.track("game_finished");
        const botProps = botGameProps(game);
        if (botProps) pulseTrack("bot_game_end", botProps);
        earn((s) => recordGame(s, game, new Date(), minutes));
        // The endgame trainer defends from the tablebase, not the bot, so it is not rated.
        const bot = game.setup.opponent.kind === "bot" ? game.setup.opponent.bot : null;
        if (bot && isBotId(bot) && !(ENDGAME_IDS as readonly string[]).includes(game.setup.startId ?? "")) rate(ratedGame(game, botInfo(bot).rating));
      },
      finishPuzzle: (p) => {
        both(p.solved ? "puzzle_solved" : "puzzle_failed");
        earn((s) => recordPuzzle(s, p, new Date()));
        if (p.puzzleRating) rate(ratedPuzzle({ id: p.id, solved: p.solved, puzzleRating: p.puzzleRating }, Date.now()));
      },
      serveDailyPuzzle: (day, id, puzzle) => setState((s) => serveDaily(s, day, id, puzzle)),
      finishSprint: (score, minutes) => earn((s) => recordSprint(s, score, new Date(), minutes)),
      finishVision: (game, score) => {
        setState((s) => recordVision(s, game, score, new Date()));
        // Queued, so a score made offline still reaches the class board.
        if (latest.current.account && score > 0) setState((st) => queueVisionScore(st, game, score, dayKey(new Date())));
      },
      place: (level) => setState((s) => placeAt(s, level, new Date())),
      markBadgesSeen: (ids) => setState((s) => ({ ...s, badgesSeen: [...new Set([...s.badgesSeen, ...ids])] })),
      deleteAccount: async () => {
        await api.deleteMe();
        await token.clear();
        await googleSignOut();
        setState((s) => applySignOut(s));
      },
      saveGame: (game) => {
        // A fresh game (no moves yet) against a bot is a start; later saves are the same game.
        const opp = game && game.history.length === 0 ? game.setup.opponent : null;
        if (opp?.kind === "bot") pulseTrack("bot_game_start", { bot: opp.bot, you: game!.setup.you });
        setState((s) => ({ ...s, activeGame: game }));
      },
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
      dismissCelebration: (id) => setState((s) => dismissCelebration(s, id)),
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
