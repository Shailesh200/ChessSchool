import { useMemo } from "react";
import { useSettings } from "@/settings";
import { isPremiumLook } from "./uiLook";
import {
  premiumColors,
  premiumFont,
  premiumRadius,
  premiumSpace,
  premiumType,
} from "./premiumTokens";

/** Hook for premium illustrated screens (nov2 / boa). */
export function usePremiumTheme() {
  const settings = useSettings();
  const on = isPremiumLook(settings);

  return useMemo(
    () => ({
      on,
      colors: premiumColors,
      space: premiumSpace,
      radius: premiumRadius,
      type: premiumType,
      font: premiumFont,
    }),
    [on],
  );
}
