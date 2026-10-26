/**
 * Accessibility props spread onto Button's Pressable.
 * An explicit, non-blank `accessibilityLabel` is forwarded as-is.
 * Otherwise the visible label is used, with one trailing arrow removed
 * (a " →", a bare "→", and whitespace around that arrow) and then trimmed.
 * The visible label text is not changed.
 */
export function buttonPressableA11yProps(
  label: string,
  accessibilityLabel?: string,
): { accessibilityLabel: string } {
  if (accessibilityLabel && accessibilityLabel.trim()) {
    return { accessibilityLabel };
  }
  return { accessibilityLabel: label.replace(/\s*→\s*$/, "").trim() };
}
