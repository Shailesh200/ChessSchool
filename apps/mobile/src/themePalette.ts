import { getAppTheme, withHighContrast } from "./appThemes";
import { getSchoolTheme } from "./schoolThemes";
import { colors as baseColors } from "./theme";

export type ThemeColors = Record<string, string>;

/** Light-theme success banner tokens (dark themes override via AppThemeDef.tints). */
const LIGHT_SUCCESS_TINT = "#e7f7ef";
const LIGHT_SUCCESS_INK = "#059669";

/**
 * App surface palette + school brand chrome. Dark app themes carry their own brand
 * tints, which win over the school theme's light pastels (otherwise brand50/100
 * would be light-on-light text surfaces in Midnight).
 */
export function buildPalette(appThemeId: string, schoolThemeId: string, highContrast: boolean): ThemeColors {
  const theme = getAppTheme(appThemeId);
  const school = getSchoolTheme(schoolThemeId);
  const palette = highContrast ? withHighContrast(theme.colors, theme.dark) : theme.colors;
  const tints = theme.tints;
  return {
    ...(baseColors as ThemeColors),
    brand: school.brand,
    brand600: school.brand600,
    brand700: school.brand700,
    brand50: tints?.brand50 ?? school.brand50,
    brand100: tints?.brand100 ?? school.brand100,
    brandInk: tints?.brandInk ?? school.brand,
    successTint: tints?.successTint ?? LIGHT_SUCCESS_TINT,
    successInk: tints?.successInk ?? LIGHT_SUCCESS_INK,
    brand300: school.brand300,
    accent: school.accent,
    accent600: school.accent600,
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
