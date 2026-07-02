import type { Metadata } from "next";
import { getCatalog } from "@/features/school/catalog.server";
import { HomeClient } from "@/components/home/HomeClient";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { HomeSeoSection } from "@/components/home/HomeSeoSection";
import { HOME_DESCRIPTION, HOME_TITLE, SEO_KEYWORDS, socialMeta } from "@/lib/seo";

// Catalog is cached (tag "curriculum"); the page can be prefetched + revalidated
// instead of re-rendered from scratch on every navigation.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  ...socialMeta({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
    kind: "home",
    badge: "Learn Chess",
    emoji: "🎓",
  }),
};

export default async function HomePage() {
  const catalog = await getCatalog();
  return (
    <>
      <SiteJsonLd />
      <HomeClient catalog={catalog} />
      <HomeSeoSection />
    </>
  );
}
