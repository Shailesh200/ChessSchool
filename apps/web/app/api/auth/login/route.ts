import { NextResponse } from "next/server";
import { loginWithToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Token login for the mobile client → { token, user }. */
export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const res = await loginWithToken(String(email ?? ""), String(password ?? ""));
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 401 });
  return NextResponse.json(res);
}
