import type { MetadataRoute } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { classes, lessons } from "@/db/schema";
import { resolveSiteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await resolveSiteUrl();
  const cls = await db
    .select({ id: classes.id })
    .from(classes)
    .orderBy(asc(classes.sortOrder));
  const lessonRows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .orderBy(asc(lessons.sortOrder));

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: origin, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/academy`, changeFrequency: "daily", priority: 0.95 },
    { url: `${origin}/learn-chess`, changeFrequency: "weekly", priority: 0.95 },
    {
      url: `${origin}/chess-for-beginners`,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    { url: `${origin}/library`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/play`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${origin}/review`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${origin}/login`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${origin}/register`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${origin}/placement`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${origin}/support`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${origin}/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${origin}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const classRoutes = cls.map((c) => ({
    url: `${origin}/class/${c.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const lessonRoutes = lessonRows.map((l) => ({
    url: `${origin}/lesson/${l.id}`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...classRoutes, ...lessonRoutes];
}
