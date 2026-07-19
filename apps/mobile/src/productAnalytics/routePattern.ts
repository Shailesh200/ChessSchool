/** Collapse dynamic Expo Router segments for page_view aggregation. */
export function routePattern(pathname: string): string {
  if (!pathname) return "/";
  const path = pathname.split("?")[0] || "/";
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return "/";

  const DYNAMIC_PARENTS = new Set([
    "lesson",
    "class",
    "online",
    "homework",
    "review",
    "school",
  ]);

  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]!;
    const prev = parts[i - 1];
    if (seg.startsWith("(") && seg.endsWith(")")) continue; // group segments
    if (prev && DYNAMIC_PARENTS.has(prev)) {
      out.push(":id");
      continue;
    }
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) ||
      (/^[a-z0-9_-]{16,}$/i.test(seg) && prev !== undefined)
    ) {
      out.push(":id");
      continue;
    }
    out.push(seg);
  }
  return `/${out.join("/")}` || "/";
}
