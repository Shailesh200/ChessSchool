/**
 * Pin Premium kit token values + legacy alias targets for tests.
 * Source: design-kit/css/tokens.css (generated from tokens.src.json).
 */

export const KIT_SEMANTIC_LIGHT = {
  brand: "#0F6B54",
  brandEdge: "#0B4A3B",
  accent: "#FF7A59",
  bg: "#FFF9F0",
  surface: "#FFFFFF",
  text: "#1F2B2D",
  line: "#EAE5DA",
} as const;

export const LEGACY_ALIAS_KEYS = [
  "--brand-500",
  "--accent-500",
  "--surface",
  "--surface-card",
  "--ink-900",
  "--hairline",
  "--shadow-button",
] as const;

/** Maps legacy CSS var names to kit semantic keys (premium-aliases.css). */
export const PREMIUM_LEGACY_ALIAS_MAP: Record<string, keyof typeof KIT_SEMANTIC_LIGHT | string> =
  {
    "--brand-500": "brand",
    "--brand-700": "brandEdge",
    "--accent-500": "accent",
    "--surface": "bg",
    "--surface-card": "surface",
    "--ink-900": "text",
    "--hairline": "line",
  };

export type UiKitMode = "premium" | "legacy";

export const DEFAULT_UI_KIT: UiKitMode = "premium";

export function resolvePremiumColorMode(appThemeId: string): "light" | "dark" {
  return appThemeId === "midnight" ? "dark" : "light";
}

export function resolveUiKit(raw: string | undefined): UiKitMode {
  return raw === "legacy" ? "legacy" : "premium";
}
