import { NextResponse } from "next/server";
import { loginWithToken } from "@/lib/auth";
import { authCredentialsSchema } from "@/lib/api-schemas";

export const dynamic = "force-dynamic";

/** Token login for the mobile client → { token, user }. */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = authCredentialsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const res = await loginWithToken(email, password);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 401 });
  return NextResponse.json(res);
}
