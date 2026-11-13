import raw from "../data/own-puzzles.json";
import type { PuzzlePack } from "./puzzles";

/** Full pack. Imported only from the bundled path so the API client does not ship it. */
export const OWN_PACK = raw as PuzzlePack;
