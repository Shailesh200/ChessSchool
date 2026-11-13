/** Flip this one line. `bundled` loads the full pack and never fetches; `api` loads `/v1/puzzles/pack`. */
export const PUZZLE_SOURCE: "api" | "bundled" = "api";

/** Full pack for Plan B. The import stays out of the client graph while this constant is `api`. */
export async function loadBundledFullPack(): Promise<import("./puzzles").PuzzlePack | null> {
  if (PUZZLE_SOURCE !== "bundled") return null;
  const { OWN_PACK } = await import("./ownPuzzlePack");
  return OWN_PACK;
}
