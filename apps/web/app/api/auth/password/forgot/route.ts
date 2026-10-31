import { after, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/api-schemas";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requestPasswordReset } from "@/lib/password-reset";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "@/lib/password-reset-messages";

export const dynamic = "force-dynamic";

const GENERIC = { ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE };

/** Request a password reset link (same generic body for every outcome). */
export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, "auth:forgot-password", {
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const raw = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const email = parsed.data.email;
  after(() => requestPasswordReset(email).catch(() => undefined));
  return NextResponse.json(GENERIC);
}
