"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { houseForGoal } from "@/lib/profile-shared";

export async function saveOnboarding(input: {
  goal: string;
  avatar: string;
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
}
