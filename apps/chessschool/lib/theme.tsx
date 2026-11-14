import { palettes, resolveTheme, withBoardColors, type Appearance, type BoardColorsId, type FontWeight, type Palette, type Scheme, type ThemeId } from "@chessschool/design";
import { createContext, useContext, useMemo } from "react";
import { Appearance as SystemAppearance, useColorScheme } from "react-native";

const FREDOKA: Record<FontWeight, string> = { regular: "Fredoka_400Regular", medium: "Fredoka_500Medium", semibold: "Fredoka_600SemiBold", bold: "Fredoka_700Bold" };
/** Baloo 2: a rounded face with Devanagari, used for everything while the app is in Hindi. */
const BALOO: Record<FontWeight, string> = { regular: "Baloo2_400Regular", medium: "Baloo2_500Medium", semibold: "Baloo2_600SemiBold", bold: "Baloo2_700Bold" };

/** Atkinson Hyperlegible: the easy-reading option (Latin only, so Hindi keeps Baloo). Two weights, mapped onto four. */
const ATKINSON: Record<FontWeight, string> = { regular: "AtkinsonHyperlegible_400Regular", medium: "AtkinsonHyperlegible_400Regular", semibold: "AtkinsonHyperlegible_700Bold", bold: "AtkinsonHyperlegible_700Bold" };

/** Mutated in place by the state provider so styles that read it at render time follow the language and font pref. */
export const fonts: Record<FontWeight, string> = { ...FREDOKA };
export const setFontsFor = (lang: string, easy = false) => Object.assign(fonts, lang === "hi" ? BALOO : easy ? ATKINSON : FREDOKA);

type Theme = { scheme: Scheme; c: Palette };
const ThemeCtx = createContext<Theme>({ scheme: "light", c: palettes.light });

export function ThemeProvider({ appearance, theme = "classroom", board = "theme", children }: { appearance: Appearance; theme?: ThemeId; board?: BoardColorsId; children: React.ReactNode }) {
  // useColorScheme() is null on the first paint (including the text splash). Fall back to the
  // OS value so a dark system does not render that splash in the light palette.
  const system = useColorScheme() ?? SystemAppearance.getColorScheme();
  const value = useMemo(() => {
    const t = resolveTheme(theme, appearance, system === "dark");
    return { scheme: t.scheme, c: withBoardColors(t.palette, board) };
  }, [theme, appearance, system, board]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
