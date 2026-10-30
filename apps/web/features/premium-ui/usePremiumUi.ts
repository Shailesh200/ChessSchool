"use client";

import { useSettings } from "@/core/store/settings.store";
import { isPremiumUi } from "@/features/premium-ui/uiShell";

export function usePremiumUi(): boolean {
  return isPremiumUi(useSettings((s) => s.uiKit));
}
