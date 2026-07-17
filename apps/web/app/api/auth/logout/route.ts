import { NextResponse } from "next/server";
import { revokeToken } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Revoke the bearer token (mobile logout). */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "auth:logout", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const h = req.headers.get("authorization");
  if (h?.startsWith("Bearer ")) await revokeToken(h.slice(7));
  return NextResponse.json({ ok: true });
}
