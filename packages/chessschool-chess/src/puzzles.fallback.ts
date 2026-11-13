import raw from "../data/own-puzzles-fallback.json";
import type { PuzzlePack } from "./puzzles";

/** The small pack shipped in the client. The full pack is loaded only in bundled mode. */
export const FALLBACK_PACK = raw as PuzzlePack;
