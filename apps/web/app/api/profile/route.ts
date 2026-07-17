import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Student profile for the mobile client (Bearer token). */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = (
    await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1)
  )[0];
  if (!profile) {
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    studentNo: profile.studentNo,
    enrolledAt: profile.enrolledAt,
    rankTitle: profile.rankTitle,
    avatarUrl: profile.avatarUrl,
    goal: profile.goal,
    house: profile.house,
    onboarded: profile.onboarded === 1,
  });
}
