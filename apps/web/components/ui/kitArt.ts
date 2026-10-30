/** Illustrated coach art. Drop files at these paths; missing files use a letter fallback. */
export function kitCoachArt(
  coach: string,
  slot: "head-neutral" | "bust-neutral" = "head-neutral",
) {
  return `/kit/coaches/${coach}/${slot}.webp`;
}
