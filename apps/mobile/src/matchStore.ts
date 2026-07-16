import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { ShadowConfig } from "./shadow";

const KEY = "chessschool.activematch";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const isWeb = Platform.OS === "web";

export type MatchMode = "bot" | "shadow" | "arena";

export type ArenaMeta = {
  runId: string;
  opponentId: string;
  bandElo: number;
  opponentName: string;
};

export type MatchEndSnapshot = {
  title: string;
  subtitle?: string;
  win: boolean;
  ratingDelta: number;
  newRating: number;
  gameId: string;
};

export type ActiveMatch = {
  matchId: string;
  mode: MatchMode;
  fen: string;
  moves: string[];
  targetElo: number;
  timeControlMin: number;
  whiteMs: number;
  blackMs: number;
  finished: boolean;
  createdAt: number;
  shadow?: ShadowConfig;
  arena?: ArenaMeta;
  endSnapshot?: MatchEndSnapshot | null;
};

let active: ActiveMatch | null = null;
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

async function readRaw(): Promise<string | null> {
  if (isWeb) return typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  return SecureStore.getItemAsync(KEY);
}

async function writeRaw(raw: string | null): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") {
      if (raw) localStorage.setItem(KEY, raw);
      else localStorage.removeItem(KEY);
    }
    return;
  }
  if (raw) await SecureStore.setItemAsync(KEY, raw);
  else await SecureStore.deleteItemAsync(KEY);
}

export async function hydrateMatchStore(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await readRaw();
    active = raw ? (JSON.parse(raw) as ActiveMatch) : null;
    if (active && !(active as { matchId?: string }).matchId) {
      active = { ...active, matchId: `g${active.createdAt}` };
    }
  } catch {
    active = null;
  }
  hydrated = true;
  emit();
}

async function persist(): Promise<void> {
  await writeRaw(active ? JSON.stringify(active) : null);
}

export function getActiveMatch(): ActiveMatch | null {
  return active && !active.finished ? active : null;
}

/** @deprecated use getActiveMatch */
export function getActiveBotMatch(): ActiveMatch | null {
  const m = getActiveMatch();
  return m?.mode === "bot" ? m : null;
}

export function subscribeMatchStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function baseMatch(mode: MatchMode, targetElo: number, timeControlMin: number): ActiveMatch {
  const ms = timeControlMin * 60_000;
  return {
    matchId: `g${Date.now()}`,
    mode,
    fen: START_FEN,
    moves: [],
    targetElo,
    timeControlMin,
    whiteMs: ms,
    blackMs: ms,
    finished: false,
    createdAt: Date.now(),
    endSnapshot: null,
  };
}

export function startBotMatch(targetElo: number, timeControlMin: number): ActiveMatch {
  active = baseMatch("bot", targetElo, timeControlMin);
  void persist();
  emit();
  return active;
}

export function startShadowMatch(shadow: ShadowConfig, timeControlMin = 0): ActiveMatch {
  active = { ...baseMatch("shadow", 1200, timeControlMin), shadow };
  void persist();
  emit();
  return active;
}

export function startArenaMatch(arena: ArenaMeta, opponentElo: number, timeControlMin = 0): ActiveMatch {
  active = { ...baseMatch("arena", opponentElo, timeControlMin), arena };
  void persist();
  emit();
  return active;
}

export function syncBotMatch(patch: {
  fen: string;
  moves: string[];
  whiteMs?: number;
  blackMs?: number;
}): void {
  if (!active || active.finished) return;
  active = {
    ...active,
    fen: patch.fen,
    moves: patch.moves,
    whiteMs: patch.whiteMs ?? active.whiteMs,
    blackMs: patch.blackMs ?? active.blackMs,
  };
  void persist();
  emit();
}

export function setMatchEndSnapshot(snapshot: MatchEndSnapshot): void {
  if (!active) return;
  active = { ...active, endSnapshot: snapshot };
  void persist();
  emit();
}

export function finishBotMatch(): void {
  if (!active) return;
  active = { ...active, finished: true };
  void persist();
  emit();
}

export function clearBotMatch(): void {
  active = null;
  void persist();
  emit();
}

export function canResumeBotMatch(targetElo: number, timeControlMin: number): boolean {
  const m = getActiveBotMatch();
  if (!m) return false;
  return m.targetElo === targetElo && m.timeControlMin === timeControlMin && m.moves.length > 0;
}

export function canResumeAnyMatch(): boolean {
  const m = getActiveMatch();
  return Boolean(m && m.moves.length > 0);
}
