import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPuzzlePackVersion, packReady, refreshPuzzlePack, subscribePuzzlePack } from "@chessschool/chess";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

/** False until AsyncStorage and, if needed, the API attempt have settled. */
export function usePuzzlePackReady(): boolean {
  const [snap, setSnap] = useState({ ready: false, version: "" });
  useEffect(() => {
    const read = () => setSnap({ ready: packReady(), version: getPuzzlePackVersion() });
    read();
    return subscribePuzzlePack(read);
  }, []);
  return snap.ready;
}

/** AsyncStorage cannot be read before the first paint, so the store stays loading until this resolves. */
export function usePuzzlePackBoot() {
  useEffect(() => {
    void refreshPuzzlePack({
      storage: AsyncStorage,
      apiBase: API_URL,
      fetch: async (url, init) => {
        const res = await fetch(url, init);
        return { status: res.status, json: () => res.json() };
      },
    });
  }, []);
}
