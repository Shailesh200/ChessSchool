import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Current user from a Bearer token (mobile) or cookie (web). */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ user });
}
