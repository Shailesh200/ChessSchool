import type { Metadata } from "next";
import { LandingShell } from "@/components/landing/LandingShell";
import { LandingPage } from "@/components/landing/LandingPage";
import { getCurriculumSkeleton } from "@/features/school/curriculum-skeleton.server";
import { appSourceUrl, webBuildRevision } from "@/lib/licences";
import { HOME_DESCRIPTION, HOME_TITLE, SEO_KEYWORDS, pageSocialMeta } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: HOME_TITLE },
    description: HOME_DESCRIPTION,
    keywords: SEO_KEYWORDS,
    ...(await pageSocialMeta({
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      path: "/",
      kind: "home",
      badge: "Learn Chess",
      emoji: "🎓",
    })),
  };
}

export default async function MarketingHomePage() {
  const stats = await getCurriculumSkeleton();
  return (
    <LandingShell sourceUrl={appSourceUrl(webBuildRevision())}>
      <LandingPage stats={stats} />
    </LandingShell>
  );
}
