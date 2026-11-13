"use client";

import { getPuzzlePackVersion, refreshPuzzlePack, subscribePuzzlePack } from "@chessschool/chess";
import { useEffect, useState } from "react";

/** Re-render when a cached or API pack replaces the fallback. */
export function usePuzzlePackVersion(): string {
  const [version, setVersion] = useState(getPuzzlePackVersion);
  useEffect(() => subscribePuzzlePack(() => setVersion(getPuzzlePackVersion())), []);
  return version;
}

/** Load the cached pack, then refresh from /v1/puzzles/pack. Bundled mode never fetches. */
export function PuzzlePackBoot() {
  useEffect(() => {
    void refreshPuzzlePack({
      storage: localStorage,
      apiBase: "",
      fetch: async (url, init) => {
        const res = await fetch(url, init);
        return { status: res.status, json: () => res.json() };
      },
    });
  }, []);
  return null;
}
