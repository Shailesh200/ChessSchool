import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getApiUser } from "@/lib/auth";
import { houseForGoal } from "@/lib/profile-shared";
import { enforceRateLimit } from "@/lib/rate-limit";
import { insertAnalyticsEvents } from "@/lib/analytics/serverInsert";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  goal: z.string().trim().min(1).max(64),
  avatar: z.string().trim().min(1).max(64),
});

/** Complete enrollment wizard — mirrors `saveOnboarding` for mobile Bearer auth. */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "profile:onboarding", {
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid onboarding" }, { status: 400 });
  }

  const { goal, avatar } = parsed.data;
  await db
    .update(profiles)
    .set({
      goal,
      avatarUrl: avatar,
      house: houseForGoal(goal),
      onboarded: 1,
    })
    .where(eq(profiles.userId, user.id));

  void insertAnalyticsEvents([
    {
      name: "onboarding_complete",
      userId: user.id,
      props: { goal, avatar, source: "mobile" },
    },
  ]).catch(() => void 0);

  return NextResponse.json({ ok: true });
}
