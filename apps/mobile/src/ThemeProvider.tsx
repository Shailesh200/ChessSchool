import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSettings } from "./settings";
import { COLORBLIND, getAppTheme } from "./appThemes";
import { buildPalette, type ThemeColors } from "./themePalette";
import {
  colors as baseColors,
  radius,
  space,
  type,
  font,
  shadowCard,
  shadowElev1,
  shadowElev3,
  buttonHeight,
} from "./theme";

export type { ThemeColors };

const ThemeCtx = createContext<{ colors: ThemeColors; isDark: boolean; reducedMotion: boolean; colorblind: boolean; textScale: number }>({
  colors: baseColors as ThemeColors,
  isDark: false,
  reducedMotion: false,
  colorblind: false,
  textScale: 1,
});

/** Syncs app-wide surface palette + school brand chrome from settings. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const s = useSettings();
  const appThemeId = s.appTheme ?? "default";
  const schoolThemeId = s.schoolTheme ?? "university";
  const themeDef = getAppTheme(appThemeId);

  // Classic ("default") stays light — do not remap to Midnight from system dark mode.
  const isDark = themeDef.dark === true;

  const resolved = useMemo(() => {
    let c = buildPalette(appThemeId, schoolThemeId, s.highContrast);
    if (s.colorblind) {
      c = { ...c, success: COLORBLIND.success, danger: COLORBLIND.danger, warning: COLORBLIND.warning };
    }
    // Keep module tokens in sync for legacy static StyleSheets, but screens should use useAppTheme().
    Object.assign(baseColors, c as Record<string, string>);
    return c;
  }, [appThemeId, schoolThemeId, s.highContrast, s.colorblind]);

  const value = useMemo(
    () => ({ colors: resolved, isDark, reducedMotion: s.reducedMotion, colorblind: s.colorblind, textScale: s.textScale }),
    [resolved, isDark, s.reducedMotion, s.colorblind, s.textScale],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeCtx);
}

type TypeScale = { fontSize: number; lineHeight: number };
type ScaledType = Record<keyof typeof type, TypeScale>;

/** Type tokens scaled by settings.textScale (web root font-size % parity). */
export function useScaledType(): ScaledType {
  const { textScale } = useAppTheme();
  return useMemo(() => {
    if (textScale === 1) return type as ScaledType;
    const out = {} as ScaledType;
    for (const key of Object.keys(type) as (keyof typeof type)[]) {
      const entry = type[key];
      out[key] = {
        fontSize: Math.round(entry.fontSize * textScale),
        lineHeight: Math.round(entry.lineHeight * textScale),
      };
    }
    return out;
  }, [textScale]);
}

export { useScaledType as useType };

export {
  baseColors as colors,
  radius,
  space,
  type,
  font,
  shadowCard,
  shadowElev1,
  shadowElev3,
  buttonHeight,
};
