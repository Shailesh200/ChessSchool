import raw from "./tokens.json";

export type PremiumTokenJson = typeof raw;

export type PremiumColorTokens = Record<string, string>;

export type PremiumThemeTokens = {
  colors: PremiumColorTokens;
  space: Record<string, number>;
  radius: Record<string, number>;
  type: Record<string, { fontSize: number; lineHeight: number }>;
  buttonHeight: Record<string, number>;
  shadow: PremiumTokenJson["shadow"];
  font: PremiumTokenJson["font"];
};

function mapSemanticColors(mode: "light" | "dark"): PremiumColorTokens {
  const src = raw[mode];
  return {
    brand50: src["brand-50"],
    brand100: src["brand-100"],
    brand300: src["brand-300"],
    brand: src["brand-500"],
    brand600: src["brand-600"],
    brand700: src["brand-700"],
    accent400: src["accent-400"],
    accent: src["accent-500"],
    accent600: src["accent-600"],
    success: src["success-500"],
    success600: src["success-600"],
    danger: src["danger-500"],
    warning: src["warning-500"],
    gold: src["gold-500"],
    ink: src["ink-900"],
    ink700: src["ink-700"],
    ink500: src["ink-500"],
    ink300: src["ink-300"],
    surface: src.surface,
    surfaceCard: src["surface-card"],
    surfaceSunken: src["surface-sunken"],
    surfacePaper: src["surface-paper"],
    hairline: src.hairline,
    chipStreakBg: src["chip-streak-bg"],
    chipStreakInk: src["chip-streak-ink"],
    chipXpBg: src["chip-xp-bg"],
    chipXpInk: src["chip-xp-ink"],
    tabBarBg: src["tab-bar-bg"],
    tabActive: src["tab-active"],
    tabInactive: src["tab-inactive"],
    overlayScrim: src["overlay-scrim"],
    coachGlow: src["coach-glow"],
  };
}

export function buildPremiumTheme(mode: "light" | "dark"): PremiumThemeTokens {
  return {
    colors: mapSemanticColors(mode),
    space: raw.space,
    radius: raw.radius,
    type: raw.type,
    buttonHeight: raw.buttonHeight,
    shadow: raw.shadow,
    font: raw.font,
  };
}

export function shadowStyle(key: keyof PremiumTokenJson["shadow"]) {
  const s = raw.shadow[key];
  if (!s || !("opacity" in s)) return {};
  return {
    shadowColor: s.color,
    shadowOpacity: s.opacity,
    shadowRadius: s.radius,
    shadowOffset: { width: 0, height: s.offsetY },
    elevation: s.elevation,
  };
}

export const premiumTokensJson = raw;
