import { useCallback, useState } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "expo-router";

/** Intercept Android back while work is in progress (DP-M-015). */
export function useConfirmLeave(active: boolean) {
  const [open, setOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        setOpen(true);
        return true;
      });
      return () => sub.remove();
    }, [active]),
  );

  return { leaveOpen: open, setLeaveOpen: setOpen };
}
