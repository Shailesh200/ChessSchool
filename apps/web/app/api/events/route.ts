import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { analyticsBatchSchema } from "@/lib/api-schemas";
import { userShareAnalyticsOptIn } from "@/lib/analytics/account-consent.server";
import { insertAnalyticsEvents } from "@/lib/analytics/serverInsert";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Accept batched product analytics events from the client. */
export async function POST(req: Request) {
  // Page views + product events — allow a bursty navigation session.
  const limited = await enforceRateLimit(req, "events", {
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const user = await getApiUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!(await userShareAnalyticsOptIn(user.id))) {
    return new NextResponse(null, { status: 204 });
  }

  const raw = await req.json().catch(() => null);
  if (raw === null) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = analyticsBatchSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  try {
    await insertAnalyticsEvents(
      parsed.data.events.map((e) => ({
        name: e.name,
        props: e.props,
        pathname: e.pathname ?? null,
        userId: user.id,
        sessionId: e.sessionId ?? null,
      })),
    );
  } catch {
    return NextResponse.json({ error: "storage failed" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
