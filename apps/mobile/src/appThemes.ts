/** App surface palettes — ported from apps/web/core/themes/themes.ts */

export interface AppThemeDef {
  id: string;
  name: string;
  emoji: string;
  dark?: boolean;
  colors: {
    brand: string;
    brand600: string;
    surface: string;
    surfaceCard: string;
    surfaceSunken: string;
    hairline: string;
    ink: string;
    ink700: string;
    ink500: string;
    ink300: string;
  };
}

export const APP_THEMES: AppThemeDef[] = [
  {
    id: "default",
    name: "Classic",
    emoji: "🎓",
    colors: {
      brand: "#5b5bd6",
      brand600: "#4b46c4",
      surface: "#fbfaff",
      surfaceCard: "#ffffff",
      surfaceSunken: "#f1f0f9",
      hairline: "#e7e6f2",
      ink: "#1c1b2e",
      ink700: "#3a3850",
      ink500: "#6b6982",
      ink300: "#a9a7bd",
    },
  },
  {
    id: "blue",
    name: "School Blue",
    emoji: "💙",
    colors: {
      brand: "#2563eb",
      brand600: "#1d4ed8",
      surface: "#eef4fb",
      surfaceCard: "#ffffff",
      surfaceSunken: "#e2ecf8",
      hairline: "#d4e3f5",
      ink: "#0f172a",
      ink700: "#334155",
      ink500: "#64748b",
      ink300: "#94a3b8",
    },
  },
  {
    id: "forest",
    name: "Forest",
    emoji: "🌲",
    colors: {
      brand: "#0f7a55",
      brand600: "#0c6647",
      surface: "#eef5ee",
      surfaceCard: "#ffffff",
      surfaceSunken: "#e3efe3",
      hairline: "#d5e8d5",
      ink: "#1a2e1a",
      ink700: "#2d4a2d",
      ink500: "#5a735a",
      ink300: "#8fa88f",
    },
  },
  {
    id: "ivory",
    name: "Ivory",
    emoji: "🤍",
    colors: {
      brand: "#9a8f70",
      brand600: "#7a7158",
      surface: "#faf8f2",
      surfaceCard: "#fffdf8",
      surfaceSunken: "#f0ebe0",
      hairline: "#e5ddd0",
      ink: "#2c2820",
      ink700: "#4a4438",
      ink500: "#7a7264",
      ink300: "#a9a093",
    },
  },
  {
    id: "royal",
    name: "Royal",
    emoji: "👑",
    colors: {
      brand: "#6d28d9",
      brand600: "#5b21b6",
      surface: "#f4eefb",
      surfaceCard: "#ffffff",
      surfaceSunken: "#ebe3f7",
      hairline: "#ddd0f0",
      ink: "#1e1033",
      ink700: "#3b2560",
      ink500: "#6b5b8a",
      ink300: "#9d8fb8",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    emoji: "🌙",
    dark: true,
    colors: {
      brand: "#7b6ff0",
      brand600: "#6b5fe0",
      surface: "#14152b",
      surfaceCard: "#1d1f3a",
      surfaceSunken: "#0f1020",
      hairline: "#2a2d4a",
      ink: "#f0f0ff",
      ink700: "#c8c8e0",
      ink500: "#9898b8",
      ink300: "#686888",
    },
  },
];

export function getAppTheme(id: string): AppThemeDef {
  return APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[0]!;
}

/** High-contrast boost for accessibility. */
export function withHighContrast(palette: AppThemeDef["colors"]): AppThemeDef["colors"] {
  return {
    ...palette,
    ink: "#000000",
    ink700: "#111111",
    ink500: "#333333",
    hairline: "#999999",
    brand: palette.brand,
    brand600: palette.brand600,
  };
}

/** Colorblind-safe danger/success overrides applied at component level. */
export const COLORBLIND = {
  success: "#0072B2",
  danger: "#D55E00",
  warning: "#E69F00",
};
