/** Shared touch target + screen-reader props for icon-only circle controls (DP-M-012/013). */
export const ICON_CIRCLE_SIZE = 44;
export const ICON_CIRCLE_HIT_SLOP = 12;

export function iconCircleA11y(label: string) {
  return {
    accessibilityRole: "button" as const,
    accessibilityLabel: label,
    hitSlop: ICON_CIRCLE_HIT_SLOP,
  };
}
