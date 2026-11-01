/**
 * Font-scale policy (UI P0 cluster, ruled by Arc, Oct 30 2026):
 *
 * - There is NO global maxFontSizeMultiplier. Body text scales with the OS
 *   setting up to and including 200% and must wrap/reflow instead of clipping.
 * - Only FIXED chrome is capped, at 1.5x: the bottom tab bar labels and the
 *   board coordinate labels. These sit in fixed-size slots (a tab, a board
 *   square) where unbounded growth cannot reflow.
 *
 * Do not add this to body copy; fix the layout (wrap, flexShrink, minHeight)
 * instead. `fontScalePolicy.test.ts` enforces where the cap may be used.
 */
export const CHROME_MAX_FONT_SIZE_MULTIPLIER = 1.5;

/** Spread onto a <Text> that lives in a fixed-size chrome slot. */
export const chromeTextProps = {
  maxFontSizeMultiplier: CHROME_MAX_FONT_SIZE_MULTIPLIER,
} as const;
