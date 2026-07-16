import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  arenaXpBonus,
  createArenaRun,
  isArenaComplete,
  nextArenaOpponent,
  playerArenaPlacement,
  type ArenaBot,
  type ArenaRun,
  type ArenaRunRecord,
} from "./arena";
import { awardXp } from "./progression";
import { mutateProgress } from "./progressStore";

const KEY = "chessschool.arena";
const isWeb = Platform.OS === "web";

let active: ArenaRun | null = null;
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

export async function hydrateArenaStore(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await readRaw();
    active = raw ? (JSON.parse(raw) as ArenaRun) : null;
  } catch {
    active = null;
  }
  hydrated = true;
  emit();
}

async function persist(): Promise<void> {
  await writeRaw(active ? JSON.stringify(active) : null);
}

export function getArenaRun(): ArenaRun | null {
  return active;
}

export function subscribeArenaStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startArena(bandElo: number): ArenaRun {
  active = createArenaRun(bandElo);
  void persist();
  emit();
  return active;
}

export function recordArenaResult(opponentId: string, playerScore: number, gameId: string): void {
  if (!active) return;
  if (active.results.some((r) => r.opponentId === opponentId)) return;
  active = {
    ...active,
    results: [...active.results, { opponentId, playerScore, gameId, at: Date.now() }],
  };
  void persist();
  emit();
}

export function getNextArenaOpponent(): ArenaBot | null {
  return active ? nextArenaOpponent(active) : null;
}

export function completeArenaIfDone(): ArenaRunRecord | null {
  if (!active || !isArenaComplete(active) || active.completedAt) return null;
  const xp = arenaXpBonus(active);
  const record: ArenaRunRecord = {
    id: active.id,
    bandElo: active.bandElo,
    playerPoints: active.results.reduce((s, r) => s + r.playerScore, 0),
    placement: playerArenaPlacement(active),
    xpEarned: xp,
    completedAt: Date.now(),
  };
  void mutateProgress((snap) => awardXp(snap, xp));
  active = { ...active, completedAt: record.completedAt, xpAwarded: xp };
  void persist();
  emit();
  return record;
}

export function abandonArena(): void {
  active = null;
  void persist();
  emit();
}
