import { NextResponse } from "next/server";
import { db } from "@/db";
import { getUserByToken } from "@/lib/auth";
import { isQaSimServer } from "@/lib/qa-sim";
import { revokeSessionsForUser } from "@/lib/session-store";
import type * as schema from "@/db/schema";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

export const dynamic = "force-dynamic";

/**
 * QA simulator only: revoke every session of the caller (the Bearer token's
 * user), so the next request from any device of that user answers 401. Used by
 * the Maestro flow `qa/logout-isolation.yaml`; no app code calls it.
 *
 * Unless the qa-sim flag is on and the environment is not a real deployment
 * (see `lib/qa-sim.ts`) the route does not exist: 404 for every method.
 * It takes no user id; the body and the query string are ignored.
 */
const notFound = () => new Response(null, { status: 404 });

export async function POST(req: Request) {
  if (!isQaSimServer()) return notFound();
  const h = req.headers.get("authorization");
  const user = h?.startsWith("Bearer ") ? await getUserByToken(h.slice(7)) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const revoked = await revokeSessionsForUser(
    user.id,
    db as LibSQLDatabase<typeof schema>,
  );
  return NextResponse.json({ ok: true, revoked });
}

/** Any other method: 404 when the route is off, 405 when it is on. */
const other = () =>
  isQaSimServer() ? new Response(null, { status: 405 }) : notFound();
export const GET = other;
export const PUT = other;
export const PATCH = other;
export const DELETE = other;
