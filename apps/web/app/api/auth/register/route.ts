import { NextResponse } from "next/server";
import { registerWithToken } from "@/lib/auth";
import { authRegisterSchema } from "@/lib/api-schemas";

export const dynamic = "force-dynamic";

/** Token register for the mobile client → { token, user }. */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = authRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid registration" }, { status: 400 });
  }
  const { email, password, name } = parsed.data;
  const res = await registerWithToken(email, password, name);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
