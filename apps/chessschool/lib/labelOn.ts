/** Prefer the token colour, and fall back when it would disappear on the fill. */
export function labelOn(bg: string, preferred: string): string {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    if (h.length < 6) return 0;
    const chan = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(chan(0)) + 0.7152 * lin(chan(2)) + 0.0722 * lin(chan(4));
  };
  if (!bg.startsWith("#") || !preferred.startsWith("#")) return preferred;
  const a = lum(bg);
  const b = lum(preferred);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  if (ratio >= 3) return preferred;
  return a > 0.55 ? "#1C1B2E" : "#FFFFFF";
}
