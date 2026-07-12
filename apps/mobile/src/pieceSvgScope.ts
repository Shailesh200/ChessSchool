/** Prefix SVG definition ids so many pieces can share one screen without url(#…) clashes. */
export function scopePieceSvg(xml: string, scope: string): string {
  const safe = scope.replace(/[^a-zA-Z0-9_-]/g, "_");
  const ids = new Set<string>();
  for (const m of xml.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]!);
  if (ids.size === 0) return xml;

  let out = xml;
  // Replace longer ids first so id="a" does not corrupt id="ab".
  const sorted = [...ids].sort((a, b) => b.length - a.length);
  for (const id of sorted) {
    const next = `${safe}__${id}`;
    out = out.replaceAll(`id="${id}"`, `id="${next}"`);
    out = out.replaceAll(`url(#${id})`, `url(#${next})`);
    out = out.replaceAll(`xlink:href="#${id}"`, `xlink:href="#${next}"`);
    out = out.replaceAll(`href="#${id}"`, `href="#${next}"`);
  }
  return out;
}
