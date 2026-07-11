import type { Metadata } from "next";
import { getCatalog } from "@/features/school/catalog.server";
import { HomeClient } from "@/components/home/HomeClient";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { ACADEMY_DESCRIPTION, ACADEMY_TITLE, socialMeta } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: ACADEMY_TITLE },
  description: ACADEMY_DESCRIPTION,
  ...socialMeta({
    title: ACADEMY_TITLE,
    description: ACADEMY_DESCRIPTION,
    path: "/academy",
    kind: "home",
    badge: "Academy",
    emoji: "🎓",
  }),
};

export default async function AcademyPage() {
  const catalog = await getCatalog();
  return (
    <>
      <SiteJsonLd />
      <HomeClient catalog={catalog} />
    </>
  );
}
