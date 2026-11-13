import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPuzzlePackVersion, refreshPuzzlePack, subscribePuzzlePack } from "@chessschool/chess";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

/** Re-render when a cached or API pack replaces the fallback. */
export function usePuzzlePackVersion(): string {
  const [version, setVersion] = useState(getPuzzlePackVersion);
  useEffect(() => subscribePuzzlePack(() => setVersion(getPuzzlePackVersion())), []);
  return version;
}

/** Load the cached pack, then refresh from the app's API base. */
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
