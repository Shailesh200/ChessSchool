import type { ColorSchemeName } from "react-native";

export type ThemeMode = "system" | "light" | "dark";

export function normalizeThemeMode(value: unknown): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

/** Premium kit light/dark from Settings theme mode + OS scheme. */
export function resolvePremiumColorMode(
  themeMode: ThemeMode | undefined,
  scheme: ColorSchemeName | null | undefined,
): "light" | "dark" {
  const mode = themeMode ?? "system";
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  if (scheme === "dark") return "dark";
  return "light";
}
