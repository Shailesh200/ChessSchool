import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { useSettings } from "./settings";
import { getAppTheme, withHighContrast, COLORBLIND } from "./appThemes";
import { colors as baseColors, radius, space, type, font, shadowCard } from "./theme";

export type ThemeColors = Record<string, string>;

const ThemeCtx = createContext<{ colors: ThemeColors; isDark: boolean; reducedMotion: boolean; colorblind: boolean }>({
  colors: baseColors as ThemeColors,
  isDark: false,
  reducedMotion: false,
  colorblind: false,
});

function buildPalette(appThemeId: string, highContrast: boolean): ThemeColors {
  const theme = getAppTheme(appThemeId);
  const palette = highContrast ? withHighContrast(theme.colors) : theme.colors;
  return {
    ...(baseColors as ThemeColors),
    brand: palette.brand,
    brand600: palette.brand600,
    surface: palette.surface,
    surfaceCard: palette.surfaceCard,
    surfaceSunken: palette.surfaceSunken,
    hairline: palette.hairline,
    ink: palette.ink,
    ink700: palette.ink700,
    ink500: palette.ink500,
    ink300: palette.ink300,
  };
}

/** Syncs app-wide surface palette from settings.appTheme + a11y toggles. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const s = useSettings();
  const systemScheme = useColorScheme();
  const appThemeId = (s as SettingsWithAppTheme).appTheme ?? "default";
  const themeDef = getAppTheme(appThemeId);

  const isDark =
    themeDef.dark === true || (appThemeId === "default" && systemScheme === "dark");

  const resolved = useMemo(() => {
    let c = buildPalette(isDark && appThemeId === "default" ? "midnight" : appThemeId, s.highContrast);
    if (s.colorblind) {
      c = { ...c, success: COLORBLIND.success, danger: COLORBLIND.danger, warning: COLORBLIND.warning };
    }
    Object.assign(baseColors, c as Record<string, string>);
    return c;
  }, [appThemeId, s.highContrast, s.colorblind, isDark]);

  const value = useMemo(
    () => ({ colors: resolved, isDark, reducedMotion: s.reducedMotion, colorblind: s.colorblind }),
    [resolved, isDark, s.reducedMotion, s.colorblind],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

type SettingsWithAppTheme = { appTheme?: string };

export function useAppTheme() {
  return useContext(ThemeCtx);
}

export { baseColors as colors, radius, space, type, font, shadowCard };
