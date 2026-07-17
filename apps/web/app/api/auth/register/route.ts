import { NextResponse } from "next/server";
import { registerWithToken } from "@/lib/auth";
import { authRegisterSchema } from "@/lib/api-schemas";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Token register for the mobile client → { token, user }. */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "auth:register", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const raw = await req.json().catch(() => null);
  if (raw === null) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = authRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid registration" }, { status: 400 });
  }
  const { email, password, name } = parsed.data;
  const res = await registerWithToken(email, password, name);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
