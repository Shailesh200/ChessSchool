import raw from "./tokens.json";

export type PremiumTokenJson = typeof raw;

export type PremiumColorTokens = Record<string, string>;

export type PremiumFontFamilies = {
  displayBold: string;
  displaySemibold: string;
  displayMedium: string;
  uiBold: string;
  uiMedium: string;
  uiRegular: string;
};

export type PremiumTypeScale = Record<
  string,
  { fontSize: number; lineHeight: number }
>;

export type PremiumThemeTokens = {
  colors: PremiumColorTokens;
  space: Record<string, number>;
  radius: Record<string, number | string>;
  type: PremiumTypeScale;
  buttonHeight: Record<string, number>;
  shadow: PremiumTokenJson["shadow"];
  font: PremiumFontFamilies;
};

const BASE = 16;

function remPx(rem: number, line: number) {
  const fontSize = Math.round(rem * BASE);
  return { fontSize, lineHeight: Math.round(fontSize * line) };
}

function mapTypeScale(): PremiumTypeScale {
  const t = raw.type;
  const entry = (key: keyof typeof t) => {
    const e = t[key];
    return remPx(e.size, e.line);
  };
  return {
    "display-xl": entry("display-xl"),
    display: entry("display"),
    h1: entry("h1"),
    h2: entry("h2"),
    h3: entry("h3"),
    h4: entry("h4"),
    "body-lg": entry("body-lg"),
    body: entry("body"),
    "body-strong": entry("body-strong"),
    "body-sm": entry("body-sm"),
    caption: entry("caption"),
    overline: entry("overline"),
    button: entry("button"),
    "button-sm": entry("button-sm"),
    number: entry("number"),
    "2xl": entry("h1"),
    xl: entry("h2"),
    lg: entry("h3"),
    base: entry("body"),
    sm: entry("body-sm"),
    xs: entry("caption"),
  };
}

/** Registered via `loadKitFonts()` in app root — Fredoka fallback until loaded. */
export const KIT_FONT = {
  displayBold: "KitBricolageExtraBold",
  displaySemibold: "KitBricolageExtraBold",
  displayMedium: "KitDMSansMedium",
  uiBold: "KitDMSansBold",
  uiMedium: "KitDMSansMedium",
  uiRegular: "KitDMSansRegular",
} as const;

const FALLBACK_FONT: PremiumFontFamilies = {
  displayBold: "Fredoka_700Bold",
  displaySemibold: "Fredoka_600SemiBold",
  displayMedium: "Fredoka_500Medium",
  uiBold: "Fredoka_700Bold",
  uiMedium: "Fredoka_500Medium",
  uiRegular: "Fredoka_400Regular",
};

let kitFontsReady = false;

export function setKitFontsReady(ready: boolean) {
  kitFontsReady = ready;
}

function mapSemanticColors(mode: "light" | "dark"): PremiumColorTokens {
  const s = raw.semantic[mode];
  const e = raw.color.emerald;
  const ink = raw.color.ink;
  const coral = raw.color.coral;
  const sun = raw.color.sun;

  return {
    bg: s.bg,
    brand: s.brand,
    brand600: s["brand-hover"],
    brand700: s["brand-edge"],
    brand50: e["50"],
    brand100: e["100"],
    brand300: e["300"],
    accent: s.accent,
    accent400: coral["400"],
    accent600: s["accent-edge"],
    success: s.success,
    success600: s["success-edge"],
    danger: s.error,
    warning: sun["500"],
    gold: s.xp,
    ink: s.text,
    ink700: ink["700"],
    ink500: s["text-muted"],
    ink300: s["text-subtle"],
    surface: s.bg,
    surfaceCard: s.surface,
    surfaceSunken: s["bg-sunken"],
    surfacePaper: s.bg,
    surfaceMuted: s["surface-muted"],
    hairline: s.line,
    lineStrong: s["line-strong"],
    chipStreakBg: s["accent-soft"],
    chipStreakInk: s["streak-text"],
    chipXpBg: s["xp-soft"],
    chipXpInk: s["xp-text"],
    tabBarBg: s.surface,
    tabActive: s["tab-active-fg"],
    tabActiveBg: s["tab-active-bg"],
    tabInactive: s["text-subtle"],
    overlayScrim: s.overlay,
    coachGlow: s["brand-soft"],
    coachBubble: s["coach-bubble"],
    streakCard: s["streak-card"],
    streakCardText: s["streak-card-text"],
    streakCardChip: s["streak-card-chip"],
    textLink: s["text-link"],
    toggleOff: s["toggle-off"],
  };
}

const RN_SHADOW: Record<
  string,
  { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number }
> = {
  "1": { shadowColor: "#1F2B2D", shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  "2": { shadowColor: "#1F2B2D", shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  "3": { shadowColor: "#1F2B2D", shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  "4": { shadowColor: "#1F2B2D", shadowOpacity: 0.22, shadowRadius: 28, shadowOffset: { width: 0, height: 24 }, elevation: 12 },
  sheet: { shadowColor: "#1F2B2D", shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: -8 }, elevation: 16 },
  "dark-1": { shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  "dark-2": { shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  "dark-3": { shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
};

export function buildPremiumTheme(mode: "light" | "dark"): PremiumThemeTokens {
  const radius: Record<string, number | string> = { ...raw.radius };
  return {
    colors: mapSemanticColors(mode),
    space: raw.space,
    radius,
    type: mapTypeScale(),
    buttonHeight: {
      sm: raw.size["button-h-sm"],
      md: raw.size["button-h"],
      lg: raw.size["button-h"],
    },
    shadow: raw.shadow,
    font: kitFontsReady ? { ...KIT_FONT } : { ...FALLBACK_FONT },
  };
}

type ShadowKey = keyof typeof RN_SHADOW | "elev-1" | "elev-2" | "elev-3";

export function shadowStyle(key: ShadowKey, mode: "light" | "dark" = "light") {
  let resolved = key;
  if (key === "elev-1") resolved = "1";
  if (key === "elev-2") resolved = "2";
  if (key === "elev-3") resolved = "3";
  if (mode === "dark" && resolved === "1") resolved = "dark-1";
  if (mode === "dark" && resolved === "2") resolved = "dark-2";
  if (mode === "dark" && resolved === "3") resolved = "dark-3";
  return RN_SHADOW[resolved] ?? {};
}

export const premiumTokensJson = raw;
