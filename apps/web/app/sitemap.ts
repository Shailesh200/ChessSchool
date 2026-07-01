import type { MetadataRoute } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { classes, lessons } from "@/db/schema";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chess-school.in";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cls = await db.select({ id: classes.id }).from(classes).orderBy(asc(classes.sortOrder));
  const lessonRows = await db.select({ id: lessons.id }).from(lessons).orderBy(asc(lessons.sortOrder)).limit(500);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/library`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/play`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const classRoutes = cls.map((c) => ({
    url: `${siteUrl}/class/${c.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const lessonRoutes = lessonRows.map((l) => ({
    url: `${siteUrl}/lesson/${l.id}`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...classRoutes, ...lessonRoutes];
}
