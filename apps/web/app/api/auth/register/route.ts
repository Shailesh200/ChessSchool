import { NextResponse } from "next/server";
import { registerWithToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Token register for the mobile client → { token, user }. */
export async function POST(req: Request) {
  const { email, password, name } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
  };
  const res = await registerWithToken(String(email ?? ""), String(password ?? ""), String(name ?? ""));
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
