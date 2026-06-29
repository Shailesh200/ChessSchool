"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const HOUSE_BY_GOAL: Record<string, string> = {
  "beat-friends": "Knights",
  "reach-1000": "Pawns",
  "reach-1500": "Rooks",
  "openings": "Bishops",
  "tournament": "Queens",
};

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
      house: HOUSE_BY_GOAL[input.goal] ?? "Pawns",
      onboarded: 1,
    })
    .where(eq(profiles.userId, user.id));
}
