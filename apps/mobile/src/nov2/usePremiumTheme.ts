import { useMemo } from "react";
import { useSettings } from "@/settings";
import { isPremiumLook } from "./uiLook";
import { usePremiumKitTheme } from "@/components/kit";

/** Hook for premium illustrated screens (nov2 / boa). */
export function usePremiumTheme() {
  const settings = useSettings();
  const on = isPremiumLook(settings);
  const kit = usePremiumKitTheme();

  return useMemo(
    () => ({
      on,
      colors: kit.colors,
      space: kit.space,
      radius: kit.radius,
      type: kit.type,
      font: kit.font,
    }),
    [on, kit],
  );
}
