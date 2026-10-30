import type { PremiumMapState } from "./mapState";

const PREVIEW_STATES: PremiumMapState[] = [
  "normal",
  "dark",
  "loading",
  "empty",
  "error",
  "offline",
];

/** Dev/screenshot override: `/academy?premiumMap=offline` */
export function readPremiumMapPreviewOverride(search: string): PremiumMapState | null {
  const raw = new URLSearchParams(search).get("premiumMap");
  if (!raw) return null;
  return PREVIEW_STATES.includes(raw as PremiumMapState) ? (raw as PremiumMapState) : null;
}
