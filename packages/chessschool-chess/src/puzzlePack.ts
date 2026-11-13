import { PUZZLE_SOURCE, loadBundledFullPack } from "./puzzleSource";
import { PUZZLE_THEME_TAGS, getPuzzlePackStatus, setPuzzlePack, setPuzzlePackStatus, type Puzzle, type PuzzlePack, type PuzzleThemeId } from "./puzzles";

export const PUZZLE_PACK_KEY = "chessschool.v2.puzzlePack";
/** How long to wait for the API when nothing is cached before showing the fallback pack. */
export const PUZZLE_PACK_WAIT_MS = 3000;

const THEMES = new Set<string>(PUZZLE_THEME_TAGS);

export type PuzzlePackStorage = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
};

export type PuzzlePackResponse = { status: number; json: () => Promise<unknown> };
export type PuzzlePackFetch = (url: string, init: { headers: Record<string, string> }) => Promise<PuzzlePackResponse>;

/** Drop entries that are not a puzzle. Returns null when nothing usable remains. */
export function parsePuzzlePack(raw: unknown): PuzzlePack | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { version?: unknown; puzzles?: unknown };
  if (typeof body.version !== "string" || !body.version || !Array.isArray(body.puzzles)) return null;
  const puzzles: Puzzle[] = [];
  for (const item of body.puzzles) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id) continue;
    if (typeof p.fen !== "string" || !p.fen) continue;
    if (!Array.isArray(p.moves) || p.moves.length < 2 || p.moves.some((m) => typeof m !== "string" || !m)) continue;
    if (typeof p.rating !== "number" || !Number.isFinite(p.rating)) continue;
    if (!Array.isArray(p.themes)) continue;
    const themes = p.themes.filter((t): t is PuzzleThemeId => typeof t === "string" && THEMES.has(t));
    puzzles.push({ id: p.id, fen: p.fen, moves: p.moves as string[], rating: p.rating, themes });
  }
  if (!puzzles.length) return null;
  return { version: body.version, puzzles };
}

function isThenable<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as Promise<T> | null)?.then === "function";
}

/** Apply a cached pack and mark the store ready. Returns its version, or "" when there is nothing usable. */
function installCache(raw: string | null): string {
  if (!raw) return "";
  try {
    const cached = parsePuzzlePack(JSON.parse(raw));
    if (!cached) return "";
    setPuzzlePack(cached);
    setPuzzlePackStatus("cache");
    return cached.version;
  } catch {
    return "";
  }
}

/**
 * Install a cached pack, then refresh from the API unless `PUZZLE_SOURCE` is `bundled`.
 * A synchronous cache (localStorage) is installed before the first await.
 * With no cache, the API attempt is given `PUZZLE_PACK_WAIT_MS` before the fallback is shown.
 * 304, 404, network errors and invalid bodies leave the cache or the fallback in place.
 */
export async function refreshPuzzlePack(opts: {
  storage: PuzzlePackStorage;
  fetch: PuzzlePackFetch;
  apiBase: string;
  source?: "api" | "bundled";
}): Promise<void> {
  const source = opts.source ?? PUZZLE_SOURCE;
  if (source === "bundled" || PUZZLE_SOURCE === "bundled") {
    if (PUZZLE_SOURCE === "bundled") {
      const full = await loadBundledFullPack();
      if (full) setPuzzlePack(full);
    }
    setPuzzlePackStatus("fallback");
    return;
  }

  let version = "";
  let hadCache = false;
  try {
    const read = opts.storage.getItem(PUZZLE_PACK_KEY);
    const raw = isThenable(read) ? await read : read;
    version = installCache(raw);
    hadCache = version !== "";
  } catch {
    /* keep the fallback pack */
  }

  const pull = async (): Promise<"api" | "keep"> => {
    try {
      const base = opts.apiBase.replace(/\/$/, "");
      const headers: Record<string, string> = {};
      if (version) headers["If-None-Match"] = `"${version}"`;
      const res = await opts.fetch(`${base}/v1/puzzles/pack`, { headers });
      if (res.status !== 200) return "keep";
      const next = parsePuzzlePack(await res.json());
      if (!next) return "keep";
      setPuzzlePack(next);
      setPuzzlePackStatus("api");
      try {
        await opts.storage.setItem(PUZZLE_PACK_KEY, JSON.stringify(next));
      } catch {
        /* the memory pack is already updated */
      }
      return "api";
    } catch {
      return "keep";
    }
  };

  if (hadCache) {
    await pull();
    return;
  }

  const clock = globalThis as unknown as { setTimeout: (cb: () => void, ms: number) => unknown; clearTimeout: (id: unknown) => void };
  let timer: unknown;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = clock.setTimeout(() => resolve("timeout"), PUZZLE_PACK_WAIT_MS);
  });
  const result = await Promise.race([pull(), timeout]);
  clock.clearTimeout(timer);
  if (result !== "api" && getPuzzlePackStatus() === "loading") setPuzzlePackStatus("fallback");
}
