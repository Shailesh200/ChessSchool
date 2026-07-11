import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { analyticsBatchSchema } from "@/lib/api-schemas";
import { insertAnalyticsEvents } from "@/lib/analytics/serverInsert";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Accept batched product analytics events from the client. */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "events", { limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const raw = await req.json().catch(() => null);
  if (raw === null) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = analyticsBatchSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const user = await getApiUser(req);
  try {
    await insertAnalyticsEvents(
      parsed.data.events.map((e) => ({
        name: e.name,
        props: e.props,
        pathname: e.pathname ?? null,
        userId: user?.id ?? null,
        sessionId: e.sessionId ?? null,
      })),
    );
  } catch {
    return NextResponse.json({ error: "storage failed" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
