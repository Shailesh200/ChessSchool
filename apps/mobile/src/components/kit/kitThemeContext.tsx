import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { useSettings } from "@/settings";
import { buildPremiumTheme, type PremiumThemeTokens } from "@/theme/premium";
import { resolvePremiumColorMode } from "@/themeMode";
import { useUiKit } from "./useUiKit";

const Ctx = createContext<PremiumThemeTokens | null>(null);

/** Resolves premium kit tokens (light/dark) when uiKit is premium. */
export function PremiumKitThemeProvider({ children }: { children: ReactNode }) {
  const kit = useUiKit();
  const scheme = useColorScheme();
  const themeMode = useSettings().themeMode;
  const mode = resolvePremiumColorMode(themeMode, scheme);

  const value = useMemo(() => (kit === "premium" ? buildPremiumTheme(mode) : null), [kit, mode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePremiumKitTheme(): PremiumThemeTokens {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return buildPremiumTheme("light");
  }
  return ctx;
}
