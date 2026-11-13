import { PUZZLE_SOURCE } from "./puzzleSource";
import { PUZZLE_THEME_TAGS, setPuzzlePack, type Puzzle, type PuzzlePack, type PuzzleThemeId } from "./puzzles";

export const PUZZLE_PACK_KEY = "chessschool.v2.puzzlePack";

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

/**
 * Install a cached pack, then refresh from the API unless `PUZZLE_SOURCE` is `bundled`.
 * 304, 404, network errors and invalid bodies leave the cache or the fallback in place.
 */
export async function refreshPuzzlePack(opts: {
  storage: PuzzlePackStorage;
  fetch: PuzzlePackFetch;
  apiBase: string;
  source?: "api" | "bundled";
}): Promise<void> {
  const source = opts.source ?? PUZZLE_SOURCE;
  if (source === "bundled") return;

  let version = "";
  try {
    const raw = await opts.storage.getItem(PUZZLE_PACK_KEY);
    if (raw) {
      const cached = parsePuzzlePack(JSON.parse(raw));
      if (cached) {
        setPuzzlePack(cached);
        version = cached.version;
      }
    }
  } catch {
    /* keep the fallback pack */
  }

  try {
    const base = opts.apiBase.replace(/\/$/, "");
    const headers: Record<string, string> = {};
    if (version) headers["If-None-Match"] = `"${version}"`;
    const res = await opts.fetch(`${base}/v1/puzzles/pack`, { headers });
    if (res.status === 304 || res.status === 404) return;
    if (res.status !== 200) return;
    const next = parsePuzzlePack(await res.json());
    if (!next) return;
    setPuzzlePack(next);
    try {
      await opts.storage.setItem(PUZZLE_PACK_KEY, JSON.stringify(next));
    } catch {
      /* the memory pack is already updated */
    }
  } catch {
    /* keep cache or fallback */
  }
}
