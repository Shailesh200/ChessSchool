/**
 * Accessibility props spread onto Button's Pressable.
 * A set label is forwarded as-is. When omitted, no `accessibilityLabel`
 * is returned, so the accessible name stays the visible label text.
 */
export function buttonPressableA11yProps(accessibilityLabel?: string): {
  accessibilityLabel?: string;
} {
  if (accessibilityLabel === undefined) return {};
  return { accessibilityLabel };
}
