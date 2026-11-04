import { palettes, resolveTheme, type Appearance, type FontWeight, type Palette, type Scheme, type ThemeId } from "@chessschool/design";
import { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

export const fonts: Record<FontWeight, string> = {
  regular: "Fredoka_400Regular",
  medium: "Fredoka_500Medium",
  semibold: "Fredoka_600SemiBold",
  bold: "Fredoka_700Bold",
};

type Theme = { scheme: Scheme; c: Palette };
const ThemeCtx = createContext<Theme>({ scheme: "light", c: palettes.light });

export function ThemeProvider({ appearance, theme = "classroom", children }: { appearance: Appearance; theme?: ThemeId; children: React.ReactNode }) {
  const system = useColorScheme();
  const value = useMemo(() => {
    const t = resolveTheme(theme, appearance, system === "dark");
    return { scheme: t.scheme, c: t.palette };
  }, [theme, appearance, system]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
