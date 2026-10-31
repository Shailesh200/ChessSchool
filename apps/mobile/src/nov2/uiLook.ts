import type { Settings } from "@/settings";

/** Visual kit: premium illustrated (nov2) vs legacy Fredoka/classic. */
export type UiLook = "premium" | "classic";

export const DEFAULT_UI_LOOK: UiLook = "premium";

export function normalizeUiLook(raw: unknown): UiLook {
  return raw === "classic" ? "classic" : "premium";
}

export function isPremiumLook(settings: Pick<Settings, "uiLook">): boolean {
  return normalizeUiLook(settings.uiLook) === "premium";
}
