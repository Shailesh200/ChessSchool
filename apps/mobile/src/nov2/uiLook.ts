import type { Settings } from "@/settings";

/** Premium illustrated kit vs legacy mobile chrome. */
export type UiLook = "premium" | "classic";

export const DEFAULT_UI_LOOK: UiLook = "premium";

export function normalizeUiLook(raw: unknown): UiLook {
  return raw === "classic" ? "classic" : "premium";
}

export function isPremiumLook(settings: Pick<Settings, "uiKit">): boolean {
  return settings.uiKit !== "classic";
}
