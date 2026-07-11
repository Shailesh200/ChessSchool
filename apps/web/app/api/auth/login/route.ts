import { NextResponse } from "next/server";
import { loginWithToken } from "@/lib/auth";
import { authCredentialsSchema } from "@/lib/api-schemas";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Token login for the mobile client → { token, user }. */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "auth:login", { limit: 15, windowMs: 60_000 });
  if (limited) return limited;

  const raw = await req.json().catch(() => null);
  if (raw === null) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = authCredentialsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const res = await loginWithToken(email, password);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 401 });
  return NextResponse.json(res);
}
