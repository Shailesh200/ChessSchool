/** How far a bottom sheet must lift so a keyboard covering the visual viewport cannot hide it. */
export function keyboardOverlap(
  layoutHeight: number,
  visualHeight: number,
  offsetTop: number,
): number {
  if (!Number.isFinite(layoutHeight) || !Number.isFinite(visualHeight)) return 0;
  const overlap = layoutHeight - visualHeight - (Number.isFinite(offsetTop) ? offsetTop : 0);
  return overlap > 0 ? Math.round(overlap) : 0;
}
