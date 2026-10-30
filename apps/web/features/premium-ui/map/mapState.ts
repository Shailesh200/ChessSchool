export type PremiumMapState = "normal" | "dark" | "loading" | "empty" | "error" | "offline";

export function resolvePremiumMapState(input: {
  online: boolean;
  ready: boolean;
  loadError: boolean;
  empty: boolean;
  dark: boolean;
}): PremiumMapState {
  if (!input.online) return "offline";
  if (input.loadError) return "error";
  if (!input.ready) return "loading";
  if (input.empty) return "empty";
  if (input.dark) return "dark";
  return "normal";
}
