import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";

/** Check EAS Update on launch and when returning to foreground; download silently. */
export function useAppUpdates() {
  const [updateReady, setUpdateReady] = useState(false);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    if (checking.current) return;
    checking.current = true;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        setUpdateReady(true);
      }
    } catch {
      /* offline or misconfigured — ignore */
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const onChange = (state: AppStateStatus) => {
      if (state === "active") void check();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [check]);

  const applyUpdate = useCallback(async () => {
    if (!updateReady) return;
    await Updates.reloadAsync();
  }, [updateReady]);

  return { updateReady, applyUpdate };
}
