"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { houseForGoal } from "@/lib/profile-shared";
import { insertAnalyticsEvents } from "@/lib/analytics/serverInsert";

export async function saveOnboarding(input: {
  goal: string;
  avatar: string;
  coach?: string;
  targetElo?: number;
  theme?: string;
  planTier?: string;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await db
    .update(profiles)
    .set({
      goal: input.goal,
      avatarUrl: input.avatar,
      house: houseForGoal(input.goal),
      onboarded: 1,
    })
    .where(eq(profiles.userId, user.id));
  void insertAnalyticsEvents([
    {
      name: "onboarding_complete",
      userId: user.id,
      props: {
        goal: input.goal,
        avatar: input.avatar,
        coach: input.coach,
        targetElo: input.targetElo,
        theme: input.theme,
        planTier: input.planTier,
        source: "web",
      },
    },
  ]).catch(() => void 0);
}
