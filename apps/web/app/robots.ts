import type { MetadataRoute } from "next";
import { resolveSiteUrl, robotsRouteForSite } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = await resolveSiteUrl();
  return robotsRouteForSite(siteUrl);
}
