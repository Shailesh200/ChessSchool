import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata = { title: "Enrollment" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = (await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1))[0];
  if (profile?.onboarded) redirect("/account");
  return <OnboardingWizard name={user.name} />;
}
