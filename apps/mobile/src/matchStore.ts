import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "chessschool.activematch";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const isWeb = Platform.OS === "web";

export type ActiveBotMatch = {
  mode: "bot";
  fen: string;
  moves: string[];
  targetElo: number;
  timeControlMin: number;
  whiteMs: number;
  blackMs: number;
  finished: boolean;
  createdAt: number;
};

let active: ActiveBotMatch | null = null;
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

async function readRaw(): Promise<string | null> {
  if (isWeb) {
    return typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  }
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
    active = raw ? (JSON.parse(raw) as ActiveBotMatch) : null;
  } catch {
    active = null;
  }
  hydrated = true;
  emit();
}

async function persist(): Promise<void> {
  await writeRaw(active ? JSON.stringify(active) : null);
}

export function getActiveBotMatch(): ActiveBotMatch | null {
  return active && !active.finished ? active : null;
}

export function subscribeMatchStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startBotMatch(targetElo: number, timeControlMin: number): ActiveBotMatch {
  const ms = timeControlMin * 60_000;
  active = {
    mode: "bot",
    fen: START_FEN,
    moves: [],
    targetElo,
    timeControlMin,
    whiteMs: ms,
    blackMs: ms,
    finished: false,
    createdAt: Date.now(),
  };
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

/** True when persisted game matches route params and can resume. */
export function canResumeBotMatch(targetElo: number, timeControlMin: number): boolean {
  const m = getActiveBotMatch();
  if (!m) return false;
  return m.targetElo === targetElo && m.timeControlMin === timeControlMin && m.moves.length > 0;
}
