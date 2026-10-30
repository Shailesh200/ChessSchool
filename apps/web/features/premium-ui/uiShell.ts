import { resolveUiKit, type UiKitMode } from "@/core/themes/kitTokens";

export type { UiKitMode };

export function isPremiumUi(kit: UiKitMode | string | undefined): boolean {
  return resolveUiKit(kit) === "premium";
}

/** Premium illustrated dark surfaces follow app midnight theme. */
export function premiumDataTheme(appTheme: string): "light" | "dark" {
  return appTheme === "midnight" ? "dark" : "light";
}
