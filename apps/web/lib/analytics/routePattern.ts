/**
 * Collapse dynamic segments so page-view analytics aggregate cleanly
 * (e.g. /lesson/pawn-power → /lesson/:id).
 */
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

    if (prev && DYNAMIC_PARENTS.has(prev)) {
      out.push(":id");
      continue;
    }
    // UUID / long opaque ids
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        seg,
      ) ||
      (/^[a-z0-9_-]{16,}$/i.test(seg) && prev !== undefined)
    ) {
      out.push(":id");
      continue;
    }
    out.push(seg);
  }
  return `/${out.join("/")}`;
}

/** Product area for grouping page views in admin insights. */
export type RouteArea =
  | "home"
  | "learn"
  | "play"
  | "progress"
  | "account"
  | "auth"
  | "marketing"
  | "admin"
  | "other";

const AREA_LABELS: Record<RouteArea, string> = {
  home: "Home",
  learn: "Learn",
  play: "Play",
  progress: "Progress",
  account: "Account",
  auth: "Auth",
  marketing: "Marketing",
  admin: "Admin",
  other: "Other",
};

export function routeAreaLabel(area: RouteArea): string {
  return AREA_LABELS[area] ?? area;
}

/** Map a pathname or normalized route pattern to a product area. */
export function routeArea(pathnameOrPattern: string): RouteArea {
  const p = pathnameOrPattern.startsWith("/")
    ? routePattern(pathnameOrPattern)
    : `/${pathnameOrPattern}`;

  if (p === "/") return "home";
  if (p.startsWith("/admin")) return "admin";
  if (p === "/login" || p === "/register") return "auth";

  if (
    p.startsWith("/lesson") ||
    p.startsWith("/class") ||
    p.startsWith("/library") ||
    p.startsWith("/homework") ||
    p.startsWith("/exam") ||
    p === "/academy" ||
    p === "/placement" ||
    p === "/plan" ||
    p === "/themes" ||
    p === "/playground"
  ) {
    return "learn";
  }

  if (p.startsWith("/play") || p === "/practice/mistakes") return "play";

  if (
    p === "/review" ||
    p.startsWith("/review/") ||
    p === "/journal" ||
    p === "/dashboard"
  ) {
    return "progress";
  }

  if (
    p === "/profile" ||
    p === "/account" ||
    p === "/settings" ||
    p === "/onboarding" ||
    p === "/welcome"
  ) {
    return "account";
  }

  if (
    p === "/about" ||
    p === "/learn-chess" ||
    p === "/chess-for-beginners" ||
    p === "/support" ||
    p === "/privacy" ||
    p === "/terms" ||
    p === "/offline"
  ) {
    return "marketing";
  }

  return "other";
}

/** Feature adoption rows shown in admin Insights (event → label). */
export const FEATURE_INSIGHTS = [
  { event: "page_view", label: "Page views" },
  { event: "signup", label: "Signups" },
  { event: "login", label: "Logins" },
  { event: "onboarding_complete", label: "Onboarding complete" },
  { event: "placement_complete", label: "Placement finished" },
  { event: "lesson_start", label: "Lessons started" },
  { event: "lesson_complete", label: "Lessons completed" },
  { event: "exam_complete", label: "Exams completed" },
  { event: "class_graduate", label: "Class graduations" },
  { event: "homework_complete", label: "Homework completed" },
  { event: "match_start", label: "Matches started" },
  { event: "match_end", label: "Matches finished" },
  { event: "bot_game_start", label: "Bot games started" },
  { event: "online_game_create", label: "Online games created" },
  { event: "online_game_join", label: "Online games joined" },
  { event: "game_end", label: "Games finished" },
  { event: "feature_open", label: "Feature opens" },
  { event: "think_puzzle_result", label: "Think puzzle results" },
  { event: "search_open", label: "Search opened" },
  { event: "journal_reflection", label: "Journal reflections" },
  { event: "search_result_open", label: "Search result opens" },
  { event: "enroll_cta_click", label: "Enroll CTA clicks" },
  { event: "coach_character_select", label: "Coach picks" },
  { event: "pwa_install", label: "PWA installs" },
  { event: "account_delete", label: "Account deletes" },
] as const;
