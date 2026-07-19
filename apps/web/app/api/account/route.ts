import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteUserAccount, getApiUser, revokeToken } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { insertAnalyticsEvents } from "@/lib/analytics/serverInsert";

export const dynamic = "force-dynamic";

const COOKIE = "chessschool_session";

/** Permanently delete the authenticated user's account (mobile Bearer or web cookie). */
export async function DELETE(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = enforceRateLimit(
    req,
    "account:delete",
    { limit: 5, windowMs: 60_000 },
    user.id,
  );
  if (limited) return limited;

  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) await revokeToken(bearer.slice(7));

  const jar = await cookies();
  const cookieToken = jar.get(COOKIE)?.value;
  if (cookieToken) await revokeToken(cookieToken);

  // Fire without userId so the row survives account purge of analytics_events.
  void insertAnalyticsEvents([
    {
      name: "account_delete",
      props: { role: user.role },
    },
  ]).catch(() => void 0);

  const res = await deleteUserAccount(user.id);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 403 });

  jar.delete(COOKIE);
  return NextResponse.json({ ok: true });
}
