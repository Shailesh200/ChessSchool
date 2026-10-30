import { useSettings } from "@/settings";

export type UiKitId = "premium" | "classic";

/** Premium illustrated kit (default) vs legacy mobile chrome. */
export function useUiKit(): UiKitId {
  const s = useSettings();
  return s.uiKit === "classic" ? "classic" : "premium";
}

export function isPremiumKit(): boolean {
  return useUiKit() === "premium";
}
