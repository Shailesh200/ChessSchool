"use client";

import { KitLottie } from "@/components/motion/KitLottie";
import { useSettings } from "@/core/store/settings.store";
import { resolvePremiumColorMode } from "@/core/themes/kitTokens";

/** Kit map/lesson hop loader (`loader` / `loader-dark`) with reduced-motion stills. */
export function KitRouteLoader({ label }: { label?: string }) {
  const appTheme = useSettings((s) => s.appTheme);
  const dark = resolvePremiumColorMode(appTheme) === "dark";
  const id = dark ? "loader-dark" : "loader";
  return (
    <div className="hop" role="status" data-testid="kit-route-loader">
      <KitLottie id={id} loop className="loader-lot" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
