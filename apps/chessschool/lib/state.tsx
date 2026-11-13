import {
  STORAGE_KEY,
  applyAuth,
  dayKey,
  minutesToday,
  applyMe,
  applySignOut,
  arrive,
  completeNode,
  placeAt,
  recordGame,
  recordPractice,
  recordPuzzle,
  recordSprint,
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
} from "@chessschool/design";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, token } from "./api";
import { feedback } from "./feedback";
import { googleSignOut } from "./google";
import { syncReminders } from "./notifications";

type Store = {
  ready: boolean;
  state: LocalState;
  setProfile: (p: Partial<Profile>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  setSeenWelcome: () => void;
  completeOrientation: () => void;
  completeLesson: (id: string) => void;
  finishPractice: () => void;
  finishGame: (game: GameRecord, minutes: number) => void;
  finishPuzzle: (p: { id: string; solved: boolean; newRating: number; daily?: boolean }) => void;
  serveDailyPuzzle: (day: string, id: string, puzzle?: { id: string; fen: string; moves: string[]; rating: number; themes: readonly string[] } | null) => void;
  finishSprint: (score: number, minutes: number) => void;
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
};

const Ctx = createContext<Store | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocalState>(() => createInitialState("pending"));
  const [ready, setReady] = useState(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef("");

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
      api
        .putProgress(JSON.parse(progressJson))
        .then(() => {
          lastPushed.current = progressJson;
        })
        .catch(() => {});
    }, 800);
  }, [ready, accountId, progressJson]);

  // Re-plan reminders when anything that changes them changes (goal met today, hour, name, streak).
  const today = dayKey(new Date());
  const reminderKey = [state.prefs.notifications, state.prefs.reminderHour, state.profile.name, state.profile.dailyMinutes, minutesToday(state.progress, today), state.progress.streak.lastDay, today].join("|");
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });
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
      setProfile: (p) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      setPrefs: (p) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
      setSeenWelcome: () => setState((s) => ({ ...s, seenWelcome: true })),
      completeOrientation: () => setState((s) => completeNode(s, "meet", new Date())),
      completeLesson: (id) => setState((s) => completeNode(s, id, new Date())),
      finishPractice: () => setState((s) => recordPractice(s, new Date())),
      finishGame: (game, minutes) => setState((s) => recordGame(s, game, new Date(), minutes)),
      finishPuzzle: (p) => setState((s) => recordPuzzle(s, p, new Date())),
      serveDailyPuzzle: (day, id, puzzle) => setState((s) => serveDaily(s, day, id, puzzle)),
      finishSprint: (score, minutes) => setState((s) => recordSprint(s, score, new Date(), minutes)),
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
    [ready, state, cue],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppStateProvider");
  return v;
}
