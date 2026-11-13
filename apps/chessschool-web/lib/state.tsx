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
} from "@chessschool/design";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isGuestClassLimit } from "@chessschool/design";
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
  completeLesson: (id: string) => void;
  finishPractice: () => void;
  finishGame: (game: GameRecord, minutes: number) => void;
  finishPuzzle: (p: { id: string; solved: boolean; newRating: number; daily?: boolean }) => void;
  serveDailyPuzzle: (day: string, id: string) => void;
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
      setProfile: (p) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      setPrefs: (p) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
      setSeenWelcome: () => setState((s) => ({ ...s, seenWelcome: true })),
      completeOrientation: () => setState((s) => completeNode(s, "meet", new Date())),
      completeLesson: (id) => setState((s) => completeNode(s, id, new Date())),
      finishPractice: () => setState((s) => recordPractice(s, new Date())),
      finishGame: (game, minutes) => setState((s) => recordGame(s, game, new Date(), minutes)),
      finishPuzzle: (p) => setState((s) => recordPuzzle(s, p, new Date())),
      serveDailyPuzzle: (day, id) => setState((s) => serveDaily(s, day, id)),
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
    [ready, state, cue, guestGateOpen, showGuestGate, hideGuestGate],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppStateProvider");
  return v;
}
