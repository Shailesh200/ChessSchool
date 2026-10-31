import { useMemo } from "react";
import { useSettings } from "@/settings";
import { usePremiumKitTheme } from "@/components/kit";
import { isPremiumLook } from "./uiLook";

/** Premium illustrated screens: Dex kit tokens only (no parallel token map). */
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
