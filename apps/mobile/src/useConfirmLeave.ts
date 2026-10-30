import { useCallback, useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";
import { useFocusEffect, useNavigation } from "expo-router";

/** Intercept Android back and iOS swipe-back while work is in progress (DP-M-015). */
export function useConfirmLeave(active: boolean) {
  const [open, setOpen] = useState(false);
  const navigation = useNavigation();

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

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    navigation.setOptions({ gestureEnabled: !active });
    return () => {
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [active, navigation]);

  return { leaveOpen: open, setLeaveOpen: setOpen };
}
