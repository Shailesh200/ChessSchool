"use client";

import {
  STORAGE_KEY,
  applyAuth,
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
  type LessonMeta,
} from "@chessschool/design";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createUsage, dayKey, isGuestClassLimit, reviewAfter, type PracticeItem, type UsageEventName } from "@chessschool/design";
import { version } from "../package.json";
import { api } from "./api";
import { playCue } from "./sound";
import { applyAppearance, applyFavicon, applyTheme } from "./theme";

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
  place: (level: Placement) => void;
  markBadgesSeen: (ids: string[]) => void;
  deleteAccount: () => Promise<void>;
  saveGame: (game: SavedGame | null) => void;
  clearArrival: () => void;
  signedIn: (auth: AuthResponse) => void;
  signOut: () => Promise<void>;
  resetThisDevice: () => void;
  clearCeremony: () => void;
  toggleRoomReminder: (id: RoomId) => void;
  markNotificationOffered: () => void;
  cue: (c: SoundCue) => void;
  /** Records a practice answer for spaced review. */
  answerReview: (ref: string, missed: boolean) => void;
  /** Stores the next practice set for offline use. */
  setPracticeNext: (items: PracticeItem[]) => void;
  /** Anonymous usage event (dropped when "Share anonymous usage" is off). */
  track: (name: UsageEventName, extra?: { lesson?: string; step?: number; value?: number }) => void;
  guestGateOpen: boolean;
  showGuestGate: () => void;
  hideGuestGate: () => void;
};

const Ctx = createContext<Store | null>(null);
const newGuestId = () => crypto.randomUUID();

function read(): LocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return hydrateState(raw ? JSON.parse(raw) : null, newGuestId);
  } catch {
    return createInitialState(newGuestId());
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  // Server render and first client render use a stable placeholder; real state loads after mount.
  const [state, setState] = useState<LocalState>(() => createInitialState("pending"));
  const [ready, setReady] = useState(false);
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  const showGuestGate = useCallback(() => setGuestGateOpen(true), []);
  const hideGuestGate = useCallback(() => setGuestGateOpen(false), []);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef<string>("");
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });
  const [usage] = useState(() =>
    createUsage({ send: api.sendUsage, install: () => latest.current.usageId, platform: "web", appVersion: version, enabled: () => latest.current.prefs.shareUsage }),
  );
  useEffect(() => {
    if (!ready) return;
    usage.track("app_open");
    const hide = () => document.visibilityState === "hidden" && void usage.flush();
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [ready, usage]);

  useEffect(() => {
    setState(arrive(read(), new Date()));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, ready]);

  useEffect(() => {
    if (ready) applyAppearance(state.prefs.appearance);
  }, [ready, state.prefs.appearance]);
  useEffect(() => {
    if (ready) applyTheme(state.prefs.theme);
  }, [ready, state.prefs.theme]);
  useEffect(() => {
    if (ready) applyFavicon(state.prefs.appIcon);
  }, [ready, state.prefs.appIcon]);

  // Signed in: confirm the session once; a 401 means the cookie expired, so fall back to guest.
  const accountId = state.account?.id;
  useEffect(() => {
    if (!ready || !accountId) return;
    api
      .me()
      .then((me) => setState((s) => applyMe(s, me)))
      .catch((err) => {
        if (err?.status === 401) setState((s) => applySignOut(s));
      });
  }, [ready, accountId]);

  // Signed in: debounce-push progress; the server merges, never overwrites.
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
        .catch((err) => {
          if (isGuestClassLimit(err)) showGuestGate();
        });
    }, 800);
  }, [ready, accountId, progressJson, showGuestGate]);

  const cue = useCallback((c: SoundCue) => playCue(c, state.prefs.sound), [state.prefs.sound]);

  const store = useMemo<Store>(
    () => ({
      ready,
      state,
      cue,
      track: usage.track,
      answerReview: (ref, missed) => setState((s) => ({ ...s, review: reviewAfter(s.review, ref, missed, dayKey(new Date())) })),
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
      place: (level) => setState((s) => placeAt(s, level, new Date())),
      markBadgesSeen: (ids) => setState((s) => ({ ...s, badgesSeen: [...new Set([...s.badgesSeen, ...ids])] })),
      deleteAccount: async () => {
        await api.deleteMe();
        setState((s) => applySignOut(s));
      },
      saveGame: (game) => setState((s) => ({ ...s, activeGame: game })),
      clearArrival: () => setState((s) => ({ ...s, arrival: null })),
      signedIn: (auth) => {
        lastPushed.current = JSON.stringify(auth.progress);
        setState((s) => applyAuth(s, auth));
      },
      signOut: async () => {
        await api.logout().catch(() => {});
        setState((s) => applySignOut(s));
      },
      resetThisDevice: () => setState(resetDevice(newGuestId())),
      clearCeremony: () => setState((s) => ({ ...s, pendingCeremony: null })),
      toggleRoomReminder: (id) =>
        setState((s) => ({
          ...s,
          roomReminders: s.roomReminders.includes(id) ? s.roomReminders.filter((r) => r !== id) : [...s.roomReminders, id],
        })),
      markNotificationOffered: () => setState((s) => ({ ...s, notificationOffered: true })),
      guestGateOpen,
      showGuestGate,
      hideGuestGate,
    }),
    [ready, state, cue, usage, guestGateOpen, showGuestGate, hideGuestGate],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppStateProvider");
  return v;
}
