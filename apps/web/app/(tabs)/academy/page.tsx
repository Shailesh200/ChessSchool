import type { Metadata } from "next";
import { getCatalog } from "@/features/school/catalog.server";
import { HomeClient } from "@/components/home/HomeClient";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { ACADEMY_DESCRIPTION, ACADEMY_TITLE, pageSocialMeta } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: ACADEMY_TITLE },
    description: ACADEMY_DESCRIPTION,
    ...(await pageSocialMeta({
      title: ACADEMY_TITLE,
      description: ACADEMY_DESCRIPTION,
      path: "/academy",
      kind: "home",
      badge: "Academy",
      emoji: "🎓",
    })),
  };
}

export default async function AcademyPage() {
  const catalog = await getCatalog();
  return (
    <>
      <SiteJsonLd />
      <HomeClient catalog={catalog} />
    </>
  );
}
