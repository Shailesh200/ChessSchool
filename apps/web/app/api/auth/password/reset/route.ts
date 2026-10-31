import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/api-schemas";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resetPasswordWithToken } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

/** Set a new password using a single-use reset token. */
export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, "auth:reset-password", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const raw = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const res = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
