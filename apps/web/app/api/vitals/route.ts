import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { vitalsBatchSchema } from "@/lib/api-schemas";
import { insertWebVitals } from "@/lib/analytics/serverInsert";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Accept batched Core Web Vitals from the client (sendBeacon-friendly). */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "vitals", { limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const raw = await req.json().catch(() => null);
  if (raw === null) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = vitalsBatchSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const user = await getApiUser(req);
  try {
    await insertWebVitals(
      parsed.data.metrics.map((m) => ({
        name: m.name,
        value: m.value,
        rating: m.rating,
        pathname: m.pathname,
        connection: m.connection ?? null,
        userId: user?.id ?? null,
      })),
    );
  } catch {
    return NextResponse.json({ error: "storage failed" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
