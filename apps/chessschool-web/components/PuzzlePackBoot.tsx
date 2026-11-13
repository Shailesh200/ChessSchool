"use client";

import { getPuzzlePackVersion, packReady, refreshPuzzlePack, subscribePuzzlePack } from "@chessschool/chess";
import { useEffect, useState } from "react";

if (typeof window !== "undefined") {
  void refreshPuzzlePack({
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => {
        localStorage.setItem(key, value);
      },
    },
    apiBase: "",
    fetch: async (url, init) => {
      const res = await fetch(url, init);
      return { status: res.status, json: () => res.json() };
    },
  });
}

/** False until the cache (sync on web) or the API attempt has settled. Re-renders when the pack changes. */
export function usePuzzlePackReady(): boolean {
  const [snap, setSnap] = useState({ ready: false, version: "" });
  useEffect(() => {
    const read = () => setSnap({ ready: packReady(), version: getPuzzlePackVersion() });
    read();
    return subscribePuzzlePack(read);
  }, []);
  return snap.ready;
}

/** Imported from the root layout so the cache read above runs before the app tree renders. */
export function PuzzlePackBoot() {
  return null;
}
