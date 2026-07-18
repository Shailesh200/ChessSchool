import { NextResponse } from "next/server";
import { getCurriculumSkeleton } from "@/features/school/curriculum-skeleton.server";
import type { SearchResult } from "@/lib/search-types";

export const revalidate = 3600;
export type { SearchResult };

const STATIC_ACTIONS: SearchResult[] = [
  {
    id: "action-academy",
    type: "action",
    title: "Academy",
    subtitle: "Campus & journey",
    href: "/academy",
  },
  {
    id: "action-play",
    type: "action",
    title: "Play",
    subtitle: "Bot, pass & play, online",
    href: "/play",
  },
  {
    id: "action-puzzles",
    type: "action",
    title: "Puzzles for you",
    subtitle: "Practice from your mistakes",
    href: "/practice/mistakes",
  },
  {
    id: "action-journal",
    type: "action",
    title: "Journal",
    subtitle: "Reflections & mistake log",
    href: "/journal",
  },
];

function matches(q: string, ...parts: (string | null | undefined)[]): boolean {
  return parts.some((p) => p && p.toLowerCase().includes(q));
}

/** Universal curriculum + shortcut search for ⌘K / mobile search. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(
    40,
    Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20),
  );

  const actions = q
    ? STATIC_ACTIONS.filter((a) =>
        matches(q, a.title, a.subtitle, a.href.replace(/^\//, "")),
      )
    : STATIC_ACTIONS;

  if (!q) {
    return NextResponse.json({ results: actions.slice(0, limit), q: "" });
  }

  const { classes: cls, lessons: les } = await getCurriculumSkeleton();
  const classTitle = new Map(cls.map((c) => [c.id, c.title]));

  const classHits: SearchResult[] = [];
  for (const c of cls) {
    if (!matches(q, c.title, c.blurb, c.id)) continue;
    classHits.push({
      id: c.id,
      type: "class",
      title: c.title,
      subtitle: "Class",
      href: `/class/${c.id}`,
      emoji: c.emoji,
    });
    if (classHits.length >= limit) break;
  }

  const lessonHits: SearchResult[] = [];
  for (const l of les) {
    if (!matches(q, l.title, l.tag, l.id)) continue;
    lessonHits.push({
      id: l.id,
      type: "lesson",
      title: l.title,
      subtitle: classTitle.get(l.classId) ?? l.tag,
      href: `/lesson/${l.id}`,
      emoji: l.emoji,
      tag: l.tag,
    });
    if (lessonHits.length >= limit) break;
  }

  const results = [...actions, ...classHits, ...lessonHits].slice(0, limit);
  return NextResponse.json({ results, q });
}
