"use client";

import { useLayoutEffect, useState } from "react";
import { useSettings } from "@/core/store/settings.store";
import { useRehydrateReady } from "@/core/hooks/useRehydrateReady";
import { readPersistedAppTheme } from "@/core/themes/persistedAppTheme";
import { resolvePremiumColorMode, resolveUiKit } from "@/core/themes/kitTokens";

/**
 * Premium surfaces follow the persisted midnight theme before Zustand rehydrates,
 * so onboarding does not stay on the cream light tokens (QA-N2-006).
 */
export function useMidnightSurface(): "light" | "dark" {
  const appTheme = useSettings((s) => s.appTheme);
  const uiKit = useSettings((s) => s.uiKit);
  const ready = useRehydrateReady();
  const [mode, setMode] = useState<"light" | "dark">("light");

  useLayoutEffect(() => {
    const persisted = ready ? null : readPersistedAppTheme();
    const theme = persisted?.appTheme ?? appTheme;
    const kit = resolveUiKit(persisted?.uiKit ?? uiKit);
    const next = kit === "premium" ? resolvePremiumColorMode(theme) : "light";
    setMode(next);
    if (kit !== "premium" || typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.theme = next;
    root.dataset.appTheme = theme;
    root.style.colorScheme = next;
  }, [appTheme, uiKit, ready]);

  return mode;
}
