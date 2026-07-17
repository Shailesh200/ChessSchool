/** Canonical board theme ids (selectable + legacy). */
export const SELECTABLE_BOARD_THEMES = [
  "classic",
  "chalkboard",
  "marble",
  "tournament",
  "wooden",
  "neon",
  "paper",
  "midnight",
] as const;

const BOARD_ALIASES: Record<string, string> = {
  green: "tournament",
  wood: "wooden",
};

/** Map legacy / cross-surface board theme ids to a canonical id. */
export function normalizeBoardThemeId(id: string | undefined): string {
  if (!id) return "classic";
  if (BOARD_ALIASES[id]) return BOARD_ALIASES[id]!;
  if ([...SELECTABLE_BOARD_THEMES, "violet", "slate", "forest"].includes(id)) return id;
  return "classic";
}

const PIECE_ALIASES: Record<string, string> = {
  blossom: "cartoon",
  cute: "cartoon",
  barbie: "fairytale",
  princess: "fairytale",
};

const VALID_PIECES = new Set([
  "classic",
  "merida",
  "alpha",
  "marble",
  "crystal",
  "neon",
  "forest",
  "ocean",
  "cartoon",
  "fairytale",
  "anime",
  "fantasy",
]);

/** Map legacy / cross-surface piece theme ids to a canonical id. */
export function normalizePieceThemeId(id: string | undefined): string {
  if (!id) return "classic";
  if (PIECE_ALIASES[id]) return PIECE_ALIASES[id]!;
  if (VALID_PIECES.has(id)) return id;
  return "classic";
}
