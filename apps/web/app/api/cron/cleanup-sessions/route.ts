import { NextResponse } from "next/server";
import { db } from "@/db";
import { purgeExpiredSessions } from "@/lib/session-store";
import type * as schema from "@/db/schema";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

export const dynamic = "force-dynamic";

/**
 * Daily expired-session cleanup (Vercel Cron).
 * Set CRON_SECRET in env; Vercel sends `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const deleted = await purgeExpiredSessions(
    Date.now(),
    db as LibSQLDatabase<typeof schema>,
  );
  return NextResponse.json({ ok: true, deleted });
}
